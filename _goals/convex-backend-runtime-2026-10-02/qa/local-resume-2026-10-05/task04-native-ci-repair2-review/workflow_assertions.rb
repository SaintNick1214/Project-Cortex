require 'yaml'
require 'json'
path=ARGV[0]
d=YAML.load_file(path)
raise 'literal on scalar' unless YAML.parse_file(path).root.children.each_slice(2).any?{|key,value|key.value=='on'}
# Psych uses YAML 1.1 and decodes the literal on scalar to true. Keep this parser detail explicit.
trigger=d[true]
raise 'branch trigger' unless trigger['push']['branches']==['feat/convex-backend-runtime-completion']
raise 'path trigger' unless trigger['push']['paths']==['.github/workflows/task04-c8-native-infrastructure.yml']
raise 'permissions' unless d['permissions']=={'contents'=>'read'}
raise 'job set' unless d['jobs'].keys==['native-capability']
j=d['jobs']['native-capability'];s=j['steps']
raise 'runner/deadline' unless j['runs-on']=='ubuntu-24.04' && j['timeout-minutes']==20
raise 'owner guard' unless j['if']=="github.repository == 'SaintNick1214/Project-Cortex' && github.ref == 'refs/heads/feat/convex-backend-runtime-completion'"
raise 'actions' unless [s[0]['uses'],s[2]['uses']]==['actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803','actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02']
raise 'credentials' unless s[0]['with']['persist-credentials']==false
raise 'sparse' unless s[0]['with']['sparse-checkout']=="/work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair2/\n/.github/workflows/task04-c8-native-infrastructure.yml\n"
raise 'entrypoint' unless s[1]['run']=='python3 work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair2/ci-run.py'
a=s[2]['with'];prefix='${{ runner.temp }}/task04-c8-native-${{ github.run_id }}-${{ github.run_attempt }}/'
names=['host-preflight.json','native-image.json','owner-before.json','capture-command.json','owner-after-capture.json','export-content-copy.json','owner-terminal.json','host-failure.json','image-build.stdout','image-build.stderr','command-receipts/command-*.json','command-receipts/command-*.stdout','command-receipts/command-*.stderr','export-transport.json','export-transport-failure.json','export/native-capability.json','export/source-backings/pending-*']
raise 'allowlist' unless a['path'].lines.map(&:strip)==names.map{|n|prefix+n}
raise 'export failure/retention' unless s[2]['if']=='always()' && a['if-no-files-found']=='error' && a['retention-days']==7 && a['compression-level']==0 && a['include-hidden-files']==false
puts JSON.generate({'status'=>'ASSERTIONS_PASSED','source'=>path,'exportEntries'=>names,'sourceOnly'=>true,'nativeRuntime'=>'HELD'})
