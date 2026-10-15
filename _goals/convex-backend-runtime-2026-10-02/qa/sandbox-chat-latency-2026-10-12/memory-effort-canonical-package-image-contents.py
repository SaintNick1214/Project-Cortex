"""Read the exact saved image using manifest layer order, without containers or disk tar."""
import hashlib
import io
import json
import subprocess
import sys
import tarfile

image_id, manifest_path = sys.argv[1:]
with open(manifest_path) as file:
    expected = json.load(file)
base = 'opt/cortex/node_modules/'
wanted = {'opt/archives/manifest.json', base+'@cortexmemory/sdk/dist/backend/v1/manifest.json', 'usr/local/lib/node_modules/npm/package.json'}
wanted |= {'opt/archives/'+row['filename'] for row in expected['packages']}
wanted |= {base+row['name']+'/package.json' for row in expected['packages']}
layers, documents = {}, {}

def read_layer(name, stream):
    files, removals = {}, []
    try:
        with tarfile.open(fileobj=stream, mode='r|*') as layer:
            for item in layer:
                path = item.name.removeprefix('./')
                prefix, _, leaf = path.rpartition('/')
                if leaf == '.wh..wh..opq':
                    removals.append(prefix)
                elif leaf.startswith('.wh.'):
                    removals.append((prefix+'/' if prefix else '')+leaf[4:])
                elif path in wanted:
                    assert item.isfile(), path
                    data = layer.extractfile(item).read()
                    files[path] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                                   **({'json': json.loads(data)} if path.endswith('.json') else {})}
    except tarfile.ReadError:
        return
    layers[name] = {'files': files, 'removals': removals}

proc = subprocess.Popen(['docker', 'image', 'save', image_id], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    with tarfile.open(fileobj=proc.stdout, mode='r|') as outer:
        for entry in outer:
            if not entry.isfile():
                continue
            stream = outer.extractfile(entry)
            if entry.size < 262144:
                data = stream.read()
                try:
                    documents[entry.name] = json.loads(data)
                    continue
                except (ValueError, UnicodeDecodeError):
                    if entry.name.startswith('blobs/sha256/') or entry.name.endswith('/layer.tar'):
                        read_layer(entry.name, io.BytesIO(data))
            elif entry.name.startswith('blobs/sha256/') or entry.name.endswith('/layer.tar'):
                read_layer(entry.name, stream)
    error = proc.stderr.read().decode()
    code = proc.wait()
    assert code == 0, error
    saved_manifest = documents['manifest.json']
    assert len(saved_manifest) == 1
    layer_order = saved_manifest[0]['Layers']
    assert len(layer_order) == len(set(layer_order)) and set(layer_order) <= set(layers)
    config = documents[saved_manifest[0]['Config']]
    assert config['architecture'] == 'arm64' and config['os'] == 'linux'
    assert 'NODE_VERSION=24.15.0' in config['config']['Env']
    assert documents['index.json']['manifests'][0]['digest'] == image_id
    assert config['config']['Labels']['dev.cortex.manual-sandbox.source'] == expected['sourceCommit']
    found, candidates = {}, []
    for index, layer_name in enumerate(layer_order):
        layer = layers[layer_name]
        for prefix in layer['removals']:
            for path in list(found):
                if path == prefix or path.startswith(prefix+'/'):
                    del found[path]
        for path, row in layer['files'].items():
            found[path] = {**row, 'layerIndex': index, 'layer': layer_name}
            if path == 'usr/local/lib/node_modules/npm/package.json':
                candidates.append({'layerIndex': index, 'layer': layer_name, 'version': row['json']['version'], 'sha256': row['sha256']})
    assert set(found) == wanted, {'missing': sorted(wanted-set(found))}
    assert found['opt/archives/manifest.json']['json'] == expected
    for row in expected['packages']:
        assert found['opt/archives/'+row['filename']]['sha256'] == row['sha256']
        package = found[base+row['name']+'/package.json']['json']
        assert package['name'] == row['name'] and package['version'] == row['version']
    assert found[base+'@cortexmemory/sdk/dist/backend/v1/manifest.json']['sha256'] == expected['backend']['manifestSha256']
    assert found['usr/local/lib/node_modules/npm/package.json']['json']['version'] == '12.2.0'
    print(json.dumps({'status': 'ACTUAL_IMAGE_FILES_VERIFIED', 'imageId': image_id, 'dockerSaveExitCode': code,
                      'layerResolution': 'manifest.json Layers in filesystem order with whiteout handling',
                      'layerOrder': layer_order, 'npmLayerCandidatesInFilesystemOrder': candidates,
                      'files': {path: {key: value for key, value in row.items() if key != 'json'} for path, row in found.items()},
                      'installedVersions': {row['name']: found[base+row['name']+'/package.json']['json']['version'] for row in expected['packages']},
                      'nodeVersion': '24.15.0', 'npmVersion': '12.2.0',
                      'archiveManifestSha256': found['opt/archives/manifest.json']['sha256'],
                      'backendManifestSha256': expected['backend']['manifestSha256'],
                      'configLabels': config['config']['Labels'], 'platform': 'linux/arm64',
                      'runtimeContainersCreated': 0, 'runtimeContainersStarted': 0, 'largeImageArchiveWritten': False}, indent=2))
finally:
    if proc.poll() is None:
        proc.kill()
        proc.wait()
