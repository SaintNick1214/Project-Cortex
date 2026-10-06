"""Seven current source inputs. No command dispatch, imports or runtime acceptance.

All validation/derivation occurs before publication. The production entry requires
an independently released current native owner; the separate synthetic entry is
restricted to a named public control directory and emits no native authority.
"""
import gzip
import hashlib
import os
from pathlib import Path
import re
import stat

from strict_io import (Hold, Reader, consumer_pin, digest, encoded, ident, identity,
                       integer, literal, materializer_pin, read_materializer, require,
                       shape, strict_json, symlink)
from native_boundary import NativeBoundary, PHASE_ROOT

PACKAGES = ['@esbuild/linux-x64', '@types/node', 'convex', 'esbuild', 'semver', 'typescript', 'zod']
OUTPUTS = ['package-graph.json', 'original-read-map.json', 'historical-plan-index.json',
           'package-aliases.json', 'candidate/mirror-source-transform-map.json',
           'candidate/finite-producer-rules.json', 'candidate/prepared-source-inputs.json']
HISTORY_IDS = ['offline-runtime-freeze-extension', 'offline-runtime-freeze-regression',
               'offline-runtime-freeze-extra', 'freeze-after-scratch']
COUNTS = {'full8': (148325, 3110990905, 30), 'history': (70020, 3001521619, 0),
          'original': (823, 18836975, 0), 'comparison': (823, 19047356, 0),
          'packages': (3458, 76057286, 0)}
RECEIPT_KEYS = ('status', 'phase', 'binding', 'reviewRelease', 'resourcePRE', 'resourcePOST',
                'ledgerRows', 'ledger', 'ledgerCheckpoints', 'adviceLedgerCheckpoints',
                'originLedgerCheckpoints', 'sourceEligibilityLedger', 'archiveProofs',
                'sourceProofs', 'ownedFDAdviceLedger', 'rawPins', 'elapsedSeconds',
                'subjectImportedOrEvaluated', 'ROOT')


def h(raw):
    return hashlib.sha256(raw).hexdigest()


def relative(logical):
    require(logical.startswith('/workspace/Project-Cortex/'), 'EXACT_DECLARED_REPO_PREFIX')
    return literal(logical[len('/workspace/Project-Cortex/'):], False)


def source_key(phase, declared, package=None):
    if phase == 'packages':
        shape(declared, ('path', 'type', 'bytes', 'sha256'))
        require(declared['type'] == 'regular', 'ALL_PACKAGE_REGULAR_MEMBERS')
    elif phase == 'full8':
        shape(declared, ('path', 'kind', 'mode', 'bytes', 'sha256'), ('targetHex',))
        require(declared['kind'] in ('file', 'literal-symlink'), 'FULL8_ROW_KIND')
        integer(declared['mode'], 0o7777)
        require(('targetHex' in declared) == (declared['kind'] == 'literal-symlink'), 'FULL8_LITERAL_TARGET_MEMBERSHIP')
    elif phase in ('original', 'comparison'):
        shape(declared, ('path', 'bytes', 'sha256'))
        relative(declared['path'])
    else:
        shape(declared, ('path', 'bytes', 'sha256'), ('kind', 'packet', 'manifest'))
        # Historical recipe labels are finite declarations, not physical authority.
        if 'kind' in declared:
            require(declared['kind'] in ('EXACT_OLD_GUARD_NEGATIVE_HISTORY_FIXTURE', 'HISTORICAL_MANIFEST_MEMBER'), 'UNKNOWN_HISTORY_ROW_KIND')
    integer(declared['bytes']); digest(declared['sha256'])
    return (package + '::' if phase == 'packages' else '') + declared['path']


class Prepared:
    def __init__(self, request, contract, authority, synthetic=False):
        self.request, self.contract, self.authority = request, contract, authority
        self.synthetic = synthetic
        self.after_write = lambda: None
        self.reader = Reader(authority.verify, deadline_seconds=120)
        self.cohorts = {}; self.files = {}; self.output_data = {}; self.input_rows = []

    def json_input(self, value, maximum=67108864):
        row, raw = read_materializer(self.reader, value, maximum, collect=True)
        self.input_rows.append(row)
        return strict_json(raw), row

    def backing(self, value, source):
        shape(value, ('path', 'bytes', 'sha256', 'PRE', 'POST', 'pathPOST', 'encoding'), ('ownedReadAdvice',))
        require(value['encoding'] == 'RAW_EXACT_PREIMAGE', 'PHYSICAL_RAW_EXACT_PREIMAGE_REQUIRED')
        bare = {k: v for k, v in value.items() if k != 'encoding'}
        row, _ = read_materializer(self.reader, bare, self.request['limits']['maxSourceBytes'])
        require(row['bytes'] == source['bytes'] and row['sha256'] == source['sha256'], 'RAW_PREIMAGE_SOURCE_HASH_SIZE')
        return consumer_pin(row) | {'encoding': 'RAW_EXACT_PREIMAGE'}

    def prepare(self):
        r = shape(self.request, ('schema', 'scope', 'phaseRoot', 'outputRoot', 'cohorts', 'aliases',
                                'transforms', 'astFacts', 'commandContract', 'historyRecipes', 'selectorExtras', 'limits'))
        require(r['schema'] == 'C8_CURRENT_CANONICAL_INPUT_REQUEST_V1', 'REQUEST_SCHEMA')
        require(r['scope'] == ('PUBLIC_SYNTHETIC_SOURCE_CONTROL' if self.synthetic else 'CURRENT_NATIVE_SOURCE_ONLY'), 'REQUEST_SCOPE')
        require(self.synthetic or isinstance(self.authority, NativeBoundary), 'NATIVE_OWNER_BOUNDARY_REQUIRED')
        require(self.synthetic or r['phaseRoot'] == PHASE_ROOT, 'EXACT_CURRENT_PHASE_NAMESPACE')
        literal(r['phaseRoot']); literal(r['outputRoot'])
        require(r['outputRoot'] == r['phaseRoot'] + '/generated-inputs', 'FIXED_OUTPUT_NAMESPACE')
        shape(r['cohorts'], COUNTS)
        limits = shape(r['limits'], ('maxSourceBytes', 'metadataRecordBytes', 'maxLedgerBytes', 'outputFileBytes',
                                    'allOutputBytes', 'admittedFiles', 'admittedDirectories', 'admittedBytes', 'admittedInodes'))
        for value in limits.values(): integer(value)
        require(limits['metadataRecordBytes'] == 16384 and limits['outputFileBytes'] <= 536870912 and
                limits['allOutputBytes'] <= 7516192768 and limits['maxLedgerBytes'] <= 3660993536,
                'PRESERVED_METADATA_INPUT_BOUNDS')
        if not self.synthetic:
            require(limits == self.authority.release['admission'] and
                    h(encoded(self.contract)) == self.authority.release['approvedASTRecipeSHA256'], 'REVIEWED_EXACT_ADMISSION_AND_RECIPE')
            approved = self.authority.release['approvedInputHashes']
            supplied = {name: r[name]['sha256'] for name in ('aliases', 'transforms', 'astFacts', 'commandContract', 'historyRecipes')}
            supplied.update({phase + ':' + name: r['cohorts'][phase][name]['sha256'] for phase in COUNTS for name in ('receipt', 'ledger', 'declarations')})
            require(supplied == approved, 'ALL_CURRENT_REVIEWED_INPUT_CONTENT_BINDINGS')
        self.namespace_check()
        self.authority.verify()
        for phase in COUNTS: self.read_cohort(phase)
        require(type(r['selectorExtras']) is list and len(r['selectorExtras']) == 2, 'TWO_EXACT_OWN_SELECTOR_SOURCE_INPUTS')
        extras = set()
        for item in r['selectorExtras']:
            shape(item, ('logicalSource', 'freshPhysicalSource', 'beforeByteBacking'))
            logical = item['logicalSource']
            require(logical in self.contract['ownSelectorLogicalPaths'] and logical not in extras, 'OWN_SELECTOR_EXACT_MEMBERSHIP')
            extras.add(logical)
            location = self.contract['externalSelectorLogicalPaths'][logical].replace('${PHASE_ROOT}', r['phaseRoot'])
            require(item['freshPhysicalSource']['path'] == location, 'OWN_SELECTOR_LITERAL_DESTINATION')
            observed, _ = read_materializer(self.reader, item['freshPhysicalSource'], limits['maxSourceBytes'])
            self.files[location] = consumer_pin(observed) | {'beforeByteBacking': self.backing(item['beforeByteBacking'], observed)}
        self.command, self.command_pin = self.json_input(r['commandContract'])
        _, self.command_raw = self.reader.read(self.command_pin['path'], limits['maxSourceBytes'], collect=True)
        require(h(encoded(self.command)) == self.contract['commandCanonicalSHA256'], 'ALL_ORIGINAL_COMMAND_FIELDS_ARGV_GUARDS_DRIFT')
        expected_ids = self.contract['originalIds']
        require([c['id'] for c in self.command['commands']] == expected_ids and len(set(expected_ids)) == len(expected_ids), 'ALL_ORIGINAL_IDS_ORDER')
        self.build_maps()
        self.build_packages()
        self.build_history()
        self.build_rules()
        self.reader.final(); self.authority.verify(); self.namespace_check()
        self.plan_outputs()
        return self

    def namespace_check(self):
        root = Path(self.request['outputRoot']); self.reader.ancestors(root)
        if root.exists() or root.is_symlink():
            s = os.lstat(root)
            require(stat.S_ISDIR(s.st_mode) and not stat.S_ISLNK(s.st_mode) and s.st_uid == os.getuid()
                    and stat.S_IMODE(s.st_mode) == 0o700 and not os.listdir(root), 'OUTPUT_NAMESPACE_COLLISION_OR_OWNERSHIP')
        parent = root.parent
        require(parent.is_dir() and not parent.is_symlink() and parent.resolve() == parent and
                parent.stat().st_uid == os.getuid(), 'OUTPUT_PARENT_OWNERSHIP')

    def read_cohort(self, phase):
        spec = shape(self.request['cohorts'][phase], ('receipt', 'ledger', 'declarations', 'membershipSHA256'))
        digest(spec['membershipSHA256'])
        declarations = {}; order = []
        def declaration(item):
            shape(item, ('declared', 'physicalPath'), ('package', 'archiveRoot'))
            key = source_key(phase, item['declared'], item.get('package')); literal(item['physicalPath'])
            require(key not in declarations, 'DUPLICATE_DECLARED_COHORT_PATH')
            require(item['physicalPath'].startswith(self.request['phaseRoot'] + '/cohorts/' + phase + '/'), 'LITERAL_COHORT_DESTINATION')
            if phase == 'packages':
                require(item.get('package') in PACKAGES, 'EXACT_SEVEN_PACKAGE_MEMBERSHIP')
                archive = literal(item.get('archiveRoot'), False)
                require(item['declared']['path'].startswith(archive + '/'), 'EXACT_PACKAGE_ARCHIVE_MEMBER_PREFIX')
                expected_path = self.request['phaseRoot'] + '/cohorts/packages/node_modules/' + item['package'] + '/' + literal(item['declared']['path'][len(archive)+1:], False)
            else:
                logical = item['declared']['path']
                leaf = relative(logical) if logical.startswith('/workspace/Project-Cortex/') else literal(logical, False)
                expected_path = self.request['phaseRoot'] + '/cohorts/' + phase + '/' + leaf
            require(item['physicalPath'] == expected_path, 'EXACT_FINITE_COHORT_LITERAL_MAPPING')
            declarations[key] = item; order.append(item)
        declaration_pin, _ = read_materializer(self.reader, spec['declarations'], self.request['limits']['maxLedgerBytes'], line_consumer=declaration)
        require(h(b''.join(encoded(item) for item in order)) == spec['membershipSHA256'], 'COMPLETE_DECLARATION_MEMBERSHIP_DIGEST')
        receipt, receipt_pin = self.json_input(spec['receipt'])
        shape(receipt, RECEIPT_KEYS)
        require(receipt['status'] == 'SOURCE_ONLY_PHYSICAL_COHORT_COMPLETE_NOT_RUNTIME' and receipt['phase'] == phase and
                receipt['subjectImportedOrEvaluated'] is False and receipt['ROOT'] == 'ABSENT' and receipt['ledger'] == spec['ledger'],
                'COMPLETE_CURRENT_PHYSICAL_RECEIPT_REQUIRED')
        require(receipt['binding']['sha256'] == self.authority.binding_hash and
                receipt['reviewRelease']['sha256'] == self.authority.physical_release_hash, 'CURRENT_PHYSICAL_OWNER_BINDING')
        rows = {}; bytes_total = aliases = 0
        def row(item):
            nonlocal bytes_total, aliases
            require(type(item) is dict, 'PHYSICAL_LEDGER_ROW_SCHEMA')
            declared = item.get('declared'); key = source_key(phase, declared, item.get('package'))
            require(key in declarations and key not in rows and declared == declarations[key]['declared'], 'EXACT_COMPLETE_COHORT_ROW_MEMBERSHIP')
            required = ('declared', 'historicalIdentityAdopted')
            require(item.get('historicalIdentityAdopted') is False, 'NO_HISTORICAL_PHYSICAL_IDENTITY_ADOPTION')
            expected_path = declarations[key]['physicalPath']
            if phase == 'full8' and declared['kind'] == 'literal-symlink':
                shape(item, required + ('freshLiteralSymlink', 'targetHex', 'beforeByteBacking', 'PRE', 'POST', 'pathPOST'))
                target = bytes.fromhex(item['targetHex'])
                require(item['targetHex'] == declared['targetHex'] and len(target) == declared['bytes'] and h(target) == declared['sha256'] and
                        item['freshLiteralSymlink'] == os.fsdecode(target) and item['PRE'] == item['POST'] == item['pathPOST'], 'ALL_LITERAL_LINK_BYTES_NINE')
                # FULL8 original targets can be relative: exact readlink bytes are retained.
                self.read_literal_link(expected_path, target, item['PRE'])
                aliases += 1
                backing = self.backing(item['beforeByteBacking'] | {'encoding': 'RAW_EXACT_PREIMAGE'}, declared)
                observed = {'path': expected_path, 'bytes': declared['bytes'], 'sha256': declared['sha256'], 'identity': item['PRE'], 'kind': 'literal-symlink', 'targetHex': item['targetHex'], 'beforeByteBacking': backing}
            else:
                shape(item, ('declared', 'freshPhysicalSource', 'beforeByteBacking', 'historicalIdentityAdopted'), ('package', 'packageImportedOrExecuted'))
                if phase == 'packages':
                    require(item.get('package') == declarations[key]['package'] and item.get('packageImportedOrExecuted') is False, 'PACKAGE_SOURCE_ONLY')
                source = item['freshPhysicalSource']; require(source['path'] == expected_path, 'FINITE_PHYSICAL_PATH_WIRING')
                observed_pin, _ = read_materializer(self.reader, source, self.request['limits']['maxSourceBytes'])
                require(observed_pin['sha256'] == declared['sha256'] and observed_pin['bytes'] == declared['bytes'], 'DECLARED_CURRENT_FULL_EOF_CONTENT')
                backing = self.backing(item['beforeByteBacking'], observed_pin)
                observed = consumer_pin(observed_pin) | {'beforeByteBacking': backing}
                bytes_total += observed['bytes']
            rows[key] = observed
        ledger_pin, _ = read_materializer(self.reader, spec['ledger'], self.request['limits']['maxLedgerBytes'], line_consumer=row)
        expected = self.contract.get('syntheticCounts', COUNTS)[phase] if self.synthetic else COUNTS[phase]
        require(len(rows) == expected[0] == receipt['ledgerRows'] and bytes_total == expected[1] and aliases == expected[2] and
                set(rows) == set(declarations), 'ALL_FIVE_COHORT_COUNTS_BYTES_NO_OMISSION')
        self.cohorts[phase] = rows
        self.files.update({value['path']: value for value in rows.values() if value.get('kind') != 'literal-symlink'})
        self.input_rows.extend((declaration_pin, receipt_pin, ledger_pin))

    def read_literal_link(self, path, target, expected):
        self.reader.check(); self.reader.ancestors(path); identity(expected)
        before = os.lstat(path)
        require(stat.S_ISLNK(before.st_mode) and before.st_nlink == 1 and ident(before) == expected, 'FULL8_CURRENT_LITERAL_LINK_PIN')
        if self.synthetic:
            actual = os.fsencode(os.readlink(path)); after = os.lstat(path)
        else:
            require(hasattr(os, 'O_PATH'), 'FULL8_NATIVE_O_PATH')
            fd = os.open(path, os.O_PATH | os.O_NOFOLLOW)
            try:
                require(ident(os.fstat(fd)) == expected, 'FULL8_LITERAL_OPEN_DRIFT')
                actual = os.fsencode(os.readlink('', dir_fd=fd)); after = os.fstat(fd)
            finally: os.close(fd)
        require(actual == target and ident(after) == ident(os.lstat(path)) == expected, 'FULL8_LITERAL_BYTES_OR_NINE_DRIFT')

    def build_maps(self):
        transforms, transform_pin = self.json_input(self.request['transforms'])
        shape(transforms, ('schema', 'rows'))
        require(transforms['schema'] == 'C8_LITERAL_CURRENT_MIRRORS_V1' and transform_pin['sha256'] == self.authority.transform_hash, 'REVIEWED_LITERAL_TRANSFORM_BINDING')
        original, comparison = self.cohorts['original'], self.cohorts['comparison']
        require(set(original) == set(comparison) == set(self.contract['sources']), 'ALL_823_LOGICAL_SOURCE_MEMBERSHIP')
        result = []; seen = set()
        for row in transforms['rows']:
            shape(row, ('logicalSource', 'currentMirror', 'beforeByteBacking', 'changes'))
            logical = row['logicalSource']; require(logical in original and logical not in seen, 'DUPLICATE_OR_UNKNOWN_MIRROR_LOGICAL_SOURCE'); seen.add(logical)
            expected = self.contract['sources'][logical]
            require(original[logical]['sha256'] == expected['originalSHA256'] and original[logical]['bytes'] == expected['originalBytes'] and
                    comparison[logical]['sha256'] == expected['comparisonSHA256'] and comparison[logical]['bytes'] == expected['comparisonBytes'], 'ORIGINAL_AND_C6_COMPARISON_DECLARED_BYTES')
            mirror = row['currentMirror']; require(mirror['path'] == self.request['phaseRoot'] + '/mirror/' + relative(logical), 'EXPLICIT_PER_SOURCE_MIRROR_DESTINATION')
            _, before = self.reader.read(comparison[logical]['path'], self.request['limits']['maxSourceBytes'], collect=True)
            text = before.decode('utf-8'); changes = []
            for change in row['changes']:
                shape(change, ('from', 'to', 'occurrences', 'kind'))
                require(change['kind'] == 'EXACT_LITERAL_NAMESPACE_SUBSTITUTION' and
                        [change['from'], change['to']] in self.literal_pairs(logical), 'UNAPPROVED_SOURCE_SEMANTIC_TRANSFORM')
                require(integer(change['occurrences']) > 0 and text.count(change['from']) == change['occurrences'], 'EXACT_LITERAL_TRANSFORM_OCCURRENCES')
                text = text.replace(change['from'], change['to']); changes.append(change)
            current, data = read_materializer(self.reader, mirror, self.request['limits']['maxSourceBytes'], collect=True)
            require(data == text.encode(), 'CURRENT_LITERAL_TRANSFORM_BYTES')
            backing = self.backing(row['beforeByteBacking'], current)
            source = original[logical]
            result.append({'logicalSource': logical, 'source': source['path'], 'bytes': source['bytes'], 'sha256': source['sha256'],
                           'sourceIdentity': source['identity'], 'identity': source['identity'], 'beforeByteBacking': source['beforeByteBacking'],
                           'destination': current['path'], 'destinationBytes': current['bytes'], 'destinationSHA256': current['sha256'],
                           'destinationIdentity': current['PRE'], 'prospectiveDestinationBeforeByteBacking': backing,
                           'comparisonSource': comparison[logical], 'changes': changes, 'historicalIdentityAdopted': False})
            self.files[current['path']] = consumer_pin(current) | {'beforeByteBacking': backing}
        require(seen == set(original), 'ALL_CURRENT_MIRRORS_REQUIRED')
        self.lineage = {'status': 'CURRENT_SOURCE_ONLY_INPUTS_NOT_QUALIFICATION', 'inputs': result, 'original122': 'HELD'}
        self.output_data['candidate/mirror-source-transform-map.json'] = self.lineage
        self.output_data['original-read-map.json'] = {'files': list(self.cohorts['full8'].values()), 'historicalCustody': 'BROKEN_NOT_REPAIRED', 'original122': 'HELD'}

    def literal_pairs(self, logical):
        # These are complete literal values. No prefix, suffix, basename or path normalization resolver exists.
        root = self.request['phaseRoot']
        return [[a, b.replace('${PHASE_ROOT}', root)] for a, b in self.contract['sources'][logical]['allowedLiteralPairs']]

    def build_packages(self):
        rows = self.cohorts['packages']; expected = set(PACKAGES); files = []
        for key, row in rows.items():
            require(row['path'].startswith(self.request['phaseRoot'] + '/cohorts/packages/node_modules/'), 'PACKAGE_CANONICAL_COHORT_PATH')
            files.append(row)
        self.graph = {'packages': PACKAGES, 'files': files, 'identityObservation': 'CURRENT_SOURCE_ONLY_NOT_HISTORICAL_CUSTODY'}
        aliases, _ = self.json_input(self.request['aliases'])
        shape(aliases, ('directories', 'links', 'wholeNodeModulesAlias', 'NODE_PATH'))
        require(aliases['wholeNodeModulesAlias'] is False and aliases['NODE_PATH'] == 'ABSENT' and 'NODE_PATH' not in os.environ,
                'WHOLE_NODE_MODULES_ALIAS_OR_NODE_PATH_DENIED')
        alias_root = self.request['phaseRoot'] + '/mirror/node_modules'
        directories = [alias_root, alias_root + '/@esbuild', alias_root + '/@types']
        require([row['path'] for row in aliases['directories']] == directories, 'EXACT_ROOT_SCOPE_TOPOLOGY')
        members = [['@esbuild', '@types', 'convex', 'esbuild', 'semver', 'typescript', 'zod'], ['linux-x64'], ['node']]
        for row, wanted in zip(aliases['directories'], members):
            shape(row, ('path', 'identity', 'members')); identity(row['identity'])
            s = os.lstat(row['path']); require(stat.S_ISDIR(s.st_mode) and s.st_uid == os.getuid() and
                str(Path(row['path']).resolve()) == row['path'] and ident(s) == row['identity'] and
                row['members'] == sorted(wanted) == sorted(os.listdir(row['path'])), 'PACKAGE_ALIAS_DIRECTORY_CURRENT_MEMBERSHIP')
        require([row['package'] for row in aliases['links']] == PACKAGES, 'SEVEN_ALIAS_EXACT_ORDER')
        links = []
        for row in aliases['links']:
            shape(row, ('package', 'path', 'target', 'identity', 'capturedPackageRows'))
            name = row['package']; target = self.request['phaseRoot'] + '/cohorts/packages/node_modules/' + name
            require(row['path'] == alias_root + '/' + name and row['target'] == target, 'EXACT_LITERAL_PACKAGE_ALIAS_DESTINATION')
            observed = symlink(self.reader, row['path'], target, row['identity'], self.synthetic)
            captured = sorted(value['path'] for value in files if value['path'].startswith(target + '/'))
            actual = []
            for parent, dirs, names in os.walk(target, followlinks=False):
                for directory in dirs:
                    require(not Path(parent, directory).is_symlink(), 'PACKAGE_TARGET_DIRECTORY_ALIAS_DENIED')
                for filename in names:
                    p = Path(parent, filename); s = os.lstat(p)
                    require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1, 'PACKAGE_REGULAR_MEMBER_ONLY'); actual.append(str(p))
            require(captured == sorted(actual) and row['capturedPackageRows'] == len(captured) and captured, 'ALL_PACKAGE_ROWS_NO_EXTRA_OR_OMISSION')
            links.append({'package': name, **observed, 'capturedPackageRows': len(captured)})
        self.aliases = {'directories': [{'path': row['path'], 'identity': row['identity']} for row in aliases['directories']],
                        'links': links, 'wholeNodeModulesAlias': False, 'NODE_PATH': 'ABSENT',
                        'packageGraphSHA256': h(encoded(self.graph))}
        self.output_data['package-graph.json'] = self.graph; self.output_data['package-aliases.json'] = self.aliases

    def build_history(self):
        recipes, recipe_pin = self.json_input(self.request['historyRecipes'])
        shape(recipes, ('kind', 'perId', 'sourceRecipeProvenance'))
        require(recipes['kind'] == 'SOURCE_BOUND_HISTORICAL_INPUT_RECIPES_NO_AMBIENT_READ_MAP_PERMISSION' and
                set(recipes['perId']) == set(HISTORY_IDS), 'EXACT_FOUR_HISTORICAL_CONSUMER_RECIPES')
        history = self.cohorts['history']; self.history_data = {}; seen_whole = set()
        for command_id in HISTORY_IDS:
            spec = shape(recipes['perId'][command_id], ('paths', 'sourcePins'))
            require(type(spec['paths']) is list and len(spec['paths']) == len(set(spec['paths'])), 'DUPLICATE_HISTORY_RECIPE_MEMBER')
            require(all(path in history for path in spec['paths']), 'UNKNOWN_HISTORY_RECIPE_PATH')
            if command_id == 'freeze-after-scratch':
                require(set(spec['paths']) == set(history), 'FULL_70020_HISTORY_FREEZE_MEMBERSHIP'); seen_whole = set(spec['paths'])
            else:
                require(spec['paths'] == [self.contract['oldGuardLogical']], 'EXACT_NEGATIVE_OLD_GUARD_FIXTURE_MEMBERSHIP')
            current_pins = []
            for source in spec['sourcePins']:
                pin_observed, _ = read_materializer(self.reader, source, self.request['limits']['maxSourceBytes'])
                current_pins.append(consumer_pin(pin_observed))
            require(current_pins, 'HISTORY_SOURCE_RECIPE_PROVENANCE_REQUIRED')
            rows = []
            for path in spec['paths']:
                row = history[path]
                kind = 'EXACT_OLD_GUARD_NEGATIVE_HISTORY_FIXTURE' if path == self.contract['oldGuardLogical'] else 'HISTORICAL_MANIFEST_MEMBER'
                rows.append(row | {'kind': kind, 'declaredLogicalPath': path})
            self.history_data[command_id] = {'rows': rows, 'sourcePins': current_pins, 'kind': recipes['kind'],
                'original122': 'HELD', 'historicalCustody': 'BROKEN_NOT_REPAIRED'}
        require(seen_whole == set(history), 'WHOLE_HISTORY_REQUIRED')
        self.history_provenance = {'currentRecipePin': consumer_pin(recipe_pin), 'sourceRecipeProvenance': recipes['sourceRecipeProvenance']}

    def build_rules(self):
        facts, facts_pin = self.json_input(self.request['astFacts'])
        shape(facts, ('schema', 'parser', 'sources'))
        require(facts['schema'] == 'C8_CURRENT_AST_FACTS_V1', 'CURRENT_AST_FACT_SCHEMA')
        parser, _ = read_materializer(self.reader, facts['parser'], self.request['limits']['maxSourceBytes'])
        require(parser['sha256'] == self.authority.parser_hash, 'REVIEWED_CURRENT_AST_PARSER_SOURCE')
        ast = {}; current_text = {}
        for fact in facts['sources']:
            shape(fact, ('source', 'fullEOF', 'calls', 'imports'))
            source = fact['source']; path = source['path']
            require(path in self.files and path not in ast and fact['fullEOF'] is True, 'AST_SOURCE_FINITE_CURRENT_MEMBERSHIP')
            current = self.files[path]; require(source == {k: current[k] for k in ('path', 'bytes', 'sha256', 'identity')}, 'AST_CURRENT_SOURCE_PIN')
            observed, raw = self.reader.read(path, self.request['limits']['maxSourceBytes'], collect=True)
            require(consumer_pin(observed) == source, 'AST_SOURCE_CURRENT_HELD_EOF')
            text = raw.decode('utf-8'); current_text[path] = text
            seen = set()
            for call in fact['calls']:
                shape(call, ('kind', 'line', 'columnStart', 'columnEnd', 'endLine', 'endColumn', 'startUTF16', 'endUTF16', 'argumentExpression', 'callTextSHA256'))
                require(call['kind'] in ('SourceTextModule', 'runInContext'), 'UNKNOWN_AST_CONSUMER_KIND')
                for key in ('line', 'columnStart', 'columnEnd', 'endLine', 'endColumn', 'startUTF16', 'endUTF16'): integer(call[key])
                require(call['line'] > 0 and call['columnStart'] > 0 and call['columnEnd'] >= call['columnStart'], 'ONE_BASED_UTF16_COORDINATES')
                key = (call['kind'], call['startUTF16'], call['endUTF16']); require(key not in seen, 'DUPLICATE_AST_CALL'); seen.add(key)
                utf = text.encode('utf-16-le'); fragment = utf[2*call['startUTF16']:2*call['endUTF16']].decode('utf-16-le')
                prefix = utf[:2*call['startUTF16']].decode('utf-16-le'); line = prefix.count('\n') + 1
                column = len(prefix.rsplit('\n', 1)[-1].encode('utf-16-le')) // 2 + 1
                require(line == call['line'] and column == call['columnStart'] and h(fragment.encode()) == call['callTextSHA256'], 'ACTUAL_CURRENT_UTF16_TOKEN_SPAN')
                require(re.search(r'(?:SourceTextModule|runInContext)\s*\(', fragment), 'ACTUAL_VM_CALL_TOKEN')
            ast[path] = fact
        map_logical = {r['logicalSource']: self.files[r['destination']] for r in self.lineage['inputs']}
        # Candidate own controls and historical guard are explicit input references, never suffix aliases.
        extra = self.contract['externalSelectorLogicalPaths']
        for logical, physical in extra.items():
            location = physical.replace('${PHASE_ROOT}', self.request['phaseRoot'])
            require(location in self.files, 'REQUIRED_CURRENT_OWN_OR_HISTORY_SELECTOR_SOURCE'); map_logical[logical] = self.files[location]
        required_producers = {map_logical[c['producerLogical']]['path'] for recipe in self.contract['recipes'].values() for c in recipe['calls']}
        require(set(ast) == required_producers, 'COMPLETE_CURRENT_AST_PRODUCER_MEMBERSHIP')
        per_id = {}; total = 0
        for command_id, recipe in self.contract['recipes'].items():
            calls = []; ordinal = {}
            for template in recipe['calls']:
                producer = map_logical[template['producerLogical']]; path = producer['path']; at = ordinal.get(path, 0); ordinal[path] = at + 1
                candidates = ast[path]['calls']; require(at < len(candidates), 'MISSING_CURRENT_AST_CALL')
                call = candidates[at]
                require(call['kind'] == template['kind'] and call['argumentExpression'] == template['argumentExpression'], 'CURRENT_AST_RECIPE_ARGUMENT_DRIFT')
                selected = []
                for logical in template['sourceLogicalPaths']:
                    require(logical in map_logical, 'UNKNOWN_FINITE_SELECTOR_SOURCE'); selected.append(map_logical[logical])
                require(call['argumentExpression'] == "'JSON'" if template['json'] else bool(selected), 'FINITE_SELECTOR_RECIPE_EMPTY_OR_JSON')
                calls.append({'producer': path, 'producerSHA256': producer['sha256'], 'producerIdentity': producer['identity'],
                              'line': call['line'], 'columnStart': call['columnStart'], 'columnEnd': call['columnEnd'],
                              'kind': call['kind'], 'argumentExpression': call['argumentExpression'], 'sources': selected,
                              'parent': template['parent'], 'canonical': template['canonical'], 'json': template['json'],
                              'resolution': template['resolution']})
            for path, count in ordinal.items(): require(count == len(ast[path]['calls']), 'UNACCOUNTED_CURRENT_AST_CALL')
            entry = map_logical[recipe['entryLogical']]['path']
            per_id[command_id] = {'entry': entry, 'calls': calls, 'parentProfile': recipe['parentProfile'],
                                  'readiness': 'FINITE_SOURCE_SELECTORS_BOUND; ORIGINAL_EXECUTION_HELD'}
            if command_id.startswith('OWN_'): per_id[command_id]['scope'] = 'OWN_ONLY_NOT_REGISTRY_OR_ROOT_ID'
            total += len(calls)
        require(set(per_id) == set(self.contract['originalIds']) | {'OWN_VM_CONSUMER_CONTROL', 'OWN_EXTERNAL_REVIEW'} and total == self.contract['selectors'], 'ALL_124_IDS_246_SELECTORS')
        self.output_data['candidate/finite-producer-rules.json'] = {'kind': 'FIXED_122_SOURCE_BOUND_VM_RULES', 'perId': per_id}

    def plan_outputs(self):
        # Four exact historical documents are consumer dependencies, not omitted extra files.
        historical_paths = {key: 'historical-' + key + '.json' for key in HISTORY_IDS}
        self.data_plan = dict(self.output_data)
        for key, name in historical_paths.items(): self.data_plan[name] = self.history_data[key]
        self.history_paths = historical_paths
        names = set(OUTPUTS) | set(historical_paths.values())
        gzip_names = {'prebytes/' + name.replace('/', '--') + '.gz' for name in names} | {'prebytes/command-contract.json.gz'}
        files = sorted(names | gzip_names | {'producer-receipt.json'})
        directories = {'candidate', 'prebytes'}
        require(len(files) == 24 and len(directories) == 2, 'FINITE_LITERAL_PRODUCER_OUTPUT_SET')
        limit = self.request['limits']
        require(limit['admittedFiles'] >= len(files) and limit['admittedDirectories'] >= len(directories) and limit['admittedInodes'] >= len(files) + len(directories), 'EXPLICIT_PRODUCER_ADMISSION_DELTA_REQUIRED')
        self.path_plan = files; self.directory_plan = sorted(directories)
        # Future stat fields are bounded by the actual 64-bit schema. Serialize the
        # maximum token envelope at every future pin occurrence, including receipt
        # observations; this is a conservative pre-write bound, never an actual count.
        root = self.request['outputRoot']
        maximum_identity = {'schema': 'FS_IDENTITY_DECIMAL_V1', 'fields': {k: '-9223372036854775808' if k in ('mtime_ns', 'ctime_ns') else '18446744073709551615' for k in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')}}
        def future_pin(name):
            return {'path': root + '/' + name, 'bytes': 536870912, 'sha256': 'f'*64, 'identity': maximum_identity,
                    'beforeByteBacking': {'path': root + '/prebytes/' + name.replace('/', '--') + '.gz', 'bytes': 536870912,
                        'sha256': 'f'*64, 'identity': maximum_identity, 'encoding': 'GZIP_EXACT_PREIMAGE'}}
        planned = dict(self.data_plan)
        index = {'kind': 'SOURCE_BOUND_HISTORICAL_INPUT_RECIPES_NO_AMBIENT_READ_MAP_PERMISSION', 'perId': {}, 'sourceRecipeProvenance': self.history_provenance}
        for key, name in historical_paths.items():
            rows = self.history_data[key]['rows']; index['perId'][key] = future_pin(name) | {'rows': len(rows), 'historicalBytes': sum(row['bytes'] for row in rows)}
        planned['historical-plan-index.json'] = index
        command_pin = consumer_pin(self.command_pin) | {'beforeByteBacking': future_pin('command-contract.json')['beforeByteBacking']}
        command_pin['beforeByteBacking']['path'] = root + '/prebytes/command-contract.json.gz'
        planned['candidate/prepared-source-inputs.json'] = {'files': [future_pin(name) for name in OUTPUTS[:-1]] + [command_pin],
            'identityObservation': 'CURRENT_NATIVE_SOURCE_ONLY', 'excludedSelf': OUTPUTS[-1], 'enclosingReceipt': root + '/producer-receipt.json'}
        sizes = {name: len(encoded(value)) for name, value in planned.items()}
        # RFC1951 stored-block overhead bound, plus gzip header/trailer. Compression
        # can only be used if each encoded output also fits its unchanged file cap.
        gzip_bound = lambda size: size + 5*((size+16382)//16383) + 18
        for name, size in list(sizes.items()): sizes['prebytes/' + name.replace('/', '--') + '.gz'] = gzip_bound(size)
        sizes['prebytes/command-contract.json.gz'] = gzip_bound(len(self.command_raw))
        future_observations = []
        for name in files:
            if name == 'producer-receipt.json': continue
            value = future_pin(name)
            future_observations.append({'path': value['path'], 'bytes': value['bytes'], 'sha256': value['sha256'],
                'PRE': maximum_identity, 'POST': maximum_identity, 'pathPOST': maximum_identity, 'EOF': True})
        receipt = {'scope': 'PUBLIC_SYNTHETIC_SOURCE_CONTROL' if self.synthetic else 'CURRENT_SOURCE_PRODUCTION_NOT_QUALIFICATION',
            'outputs': {name: future_pin(name) for name in names}, 'outputPathSet': files, 'directories': sorted(directories),
            'inputObservations': list(self.reader.observations.values()) + future_observations,
            'actualOutputBytesBeforeReceipt': 7516192768, 'fullEOFCurrentNine': True,
            'original122': 'HELD', 'ROOT': 'ABSENT', 'enablingAttestation': False}
        receipt['prewriteDemand'] = {'files': files, 'directories': sorted(directories), 'fileCount': len(files), 'directoryCount': 2,
            'perFileSerializedUpperBytes': {name: 536870912 for name in files}, 'serializedUpperBytes': 7516192768,
            'blockRoundedUpperBytesIncludingOutputRoot': 7516192768,
            'actualBytes': 'UNKNOWN_BEFORE_PUBLICATION', 'mirrors823': 'SEPARATE_ADMISSION_REQUIRED'}
        sizes['producer-receipt.json'] = len(encoded(receipt))
        require(set(sizes) == set(files), 'COMPLETE_PREWRITE_SIZE_PATH_MEMBERSHIP')
        require(max(sizes.values()) <= limit['outputFileBytes'], 'OUTPUT_FILE_BOUND_BEFORE_ANY_WRITE')
        byte_ceiling = sum(sizes.values())
        allocation = sum(((size+4095)//4096)*4096 for size in sizes.values()) + 4096*3
        require(byte_ceiling <= limit['allOutputBytes'] and allocation <= limit['admittedBytes'], 'PRODUCER_BYTE_ADMISSION_DELTA_REQUIRED')
        self.demand = {'files': files, 'directories': sorted(directories), 'fileCount': len(files), 'directoryCount': 2,
                       'perFileSerializedUpperBytes': sizes, 'serializedUpperBytes': byte_ceiling,
                       'blockRoundedUpperBytesIncludingOutputRoot': allocation,
                       'actualBytes': 'UNKNOWN_BEFORE_PUBLICATION', 'mirrors823': 'SEPARATE_ADMISSION_REQUIRED'}

    def publish(self):
        self.reader.final(); self.authority.verify(); self.namespace_check()
        root = Path(self.request['outputRoot']); limits = self.request['limits']
        total = 0; pins = {}; produced = []; actual_directories = []
        root.mkdir(mode=0o700, exist_ok=True)
        for name in self.directory_plan:
            (root / name).mkdir(mode=0o700); actual_directories.append(name)
        def write(name, raw):
            nonlocal total
            require(name in self.path_plan and name not in produced, 'FIXED_NEW_GENERATED_OUTPUT_ONLY')
            require(len(raw) <= limits['outputFileBytes'] and total + len(raw) <= limits['allOutputBytes'] and
                    total + len(raw) <= limits['admittedBytes'], 'ACTUAL_PRODUCER_OUTPUT_BYTE_BOUND')
            self.authority.verify(); self.reader.final()
            path = root / name
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            try:
                at = 0
                while at < len(raw):
                    self.reader.check(); n = os.write(fd, raw[at:at+1048576]); require(n > 0, 'GENERATED_SHORT_WRITE'); at += n
                os.fsync(fd)
            finally: os.close(fd)
            self.after_write()
            observed, data = self.reader.read(str(path), limits['outputFileBytes'], collect=True)
            require(data == raw, 'CURRENT_GENERATED_FULL_EOF_READBACK'); total += len(raw); produced.append(name)
            return consumer_pin(observed)
        def backed(name, value):
            raw = encoded(value); source = write(name, raw)
            compressed = gzip.compress(raw, mtime=0)
            archive = write('prebytes/' + name.replace('/', '--') + '.gz', compressed)
            require(gzip.decompress(compressed) == raw, 'GENERATED_GZIP_BACKING_READBACK')
            return source | {'beforeByteBacking': archive | {'encoding': 'GZIP_EXACT_PREIMAGE'}}
        command_archive = write('prebytes/command-contract.json.gz', gzip.compress(self.command_raw, mtime=0))
        for key, name in self.history_paths.items(): pins[name] = backed(name, self.history_data[key])
        index = {'kind': 'SOURCE_BOUND_HISTORICAL_INPUT_RECIPES_NO_AMBIENT_READ_MAP_PERMISSION', 'perId': {}, 'sourceRecipeProvenance': self.history_provenance}
        for key, name in self.history_paths.items():
            rows = self.history_data[key]['rows']; index['perId'][key] = pins[name] | {'rows': len(rows), 'historicalBytes': sum(row['bytes'] for row in rows)}
        self.output_data['historical-plan-index.json'] = index
        for name in OUTPUTS[:-1]: pins[name] = backed(name, self.output_data[name])
        # The actual old membership is six generated data inputs plus original closed command contract.
        files = [pins['candidate/mirror-source-transform-map.json'], pins['package-graph.json'], pins['original-read-map.json'],
                 consumer_pin(self.command_pin) | {'beforeByteBacking': command_archive | {'encoding': 'GZIP_EXACT_PREIMAGE'}}, pins['historical-plan-index.json'], pins['package-aliases.json'], pins['candidate/finite-producer-rules.json']]
        prepared = {'files': files, 'identityObservation': 'PUBLIC_SYNTHETIC_ONLY' if self.synthetic else 'CURRENT_NATIVE_SOURCE_ONLY',
                    'excludedSelf': 'candidate/prepared-source-inputs.json', 'enclosingReceipt': str(root / 'producer-receipt.json')}
        pins[OUTPUTS[-1]] = backed(OUTPUTS[-1], prepared)
        self.reader.final(); self.authority.verify()
        receipt = {'scope': 'PUBLIC_SYNTHETIC_SOURCE_CONTROL' if self.synthetic else 'CURRENT_SOURCE_PRODUCTION_NOT_QUALIFICATION',
                   'outputs': pins, 'outputPathSet': self.path_plan, 'directories': self.directory_plan,
                   'inputObservations': list(self.reader.observations.values()), 'actualOutputBytesBeforeReceipt': total, 'prewriteDemand': self.demand,
                   'fullEOFCurrentNine': True, 'original122': 'HELD', 'ROOT': 'ABSENT', 'enablingAttestation': False}
        receipt_pin = write('producer-receipt.json', encoded(receipt))
        self.reader.final(); self.authority.verify()
        require(set(produced) == set(self.path_plan), 'ALL_SEVEN_INPUTS_AND_DEPENDENCIES_PUBLISHED')
        return {'receipt': receipt_pin, 'outputs': pins, 'actualOutputBytes': total,
                'paths': produced, 'scope': receipt['scope']}


def produce_current(request, contract, authority):
    require(isinstance(authority, NativeBoundary), 'NO_SYNTHETIC_NATIVE_AUTHORITY')
    return Prepared(request, contract, authority).prepare().publish()


def produce_public_control(request, contract, authority, owned_controls_root, before_first_output_capture=lambda: None):
    root = Path(owned_controls_root)
    require(root.is_absolute() and root.resolve() == root and
            'task04-c8-current-canonical-input-producers/controls/' in str(root) + '/' and
            request['scope'] == 'PUBLIC_SYNTHETIC_SOURCE_CONTROL' and Path(request['phaseRoot']).is_relative_to(root),
            'SYNTHETIC_SCOPE_CANNOT_BECOME_NATIVE_AUTHORITY')
    prepared = Prepared(request, contract, authority, synthetic=True).prepare()
    prepared.after_write = before_first_output_capture
    return prepared.publish()
