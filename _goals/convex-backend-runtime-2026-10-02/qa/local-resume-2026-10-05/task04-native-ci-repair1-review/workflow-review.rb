require 'json'
require 'psych'
d=Psych.safe_load(File.read(ARGV[0]),aliases:false)
t=d['on'] || d[true]
j=d.fetch('jobs').fetch('native-capability')
s=j.fetch('steps')
expected=%w[host-preflight.json native-image.json owner-before.json capture-command.json owner-after-capture.json export-content-copy.json owner-terminal.json host-failure.json image-build.stdout image-build.stderr command-receipts/command-*.json command-receipts/command-*.stdout command-receipts/command-*.stderr export-transport.json export-transport-failure.json export/native-capability.json export/source-backings/pending-*]
actual=s[2].fetch('with').fetch('path').lines.map{|l|l.strip.split('/',3)[2]}
raise 'branch' unless t.fetch('push').fetch('branches')==['feat/convex-backend-runtime-completion']
raise 'trigger' unless t.fetch('push').fetch('paths')==['.github/workflows/task04-c8-native-infrastructure.yml']
raise 'permissions' unless d['permissions']=={'contents'=>'read'}
raise 'deadline' unless j['timeout-minutes']==20
raise 'runner' unless j['runs-on']=='ubuntu-24.04'
raise 'credentials' unless s[0]['with']['persist-credentials']==false
raise 'pins' unless [s[0]['uses'],s[2]['uses']]==['actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803','actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02']
raise 'export' unless actual==expected
raise 'folder' unless s[0]['with']['sparse-checkout']=="/work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair1/\n/.github/workflows/task04-c8-native-infrastructure.yml\n"
raise 'run' unless s[1]['run']=='python3 work/resume/task04-c8-physical-preparation-r3/native-ci-a5-repair1/ci-run.py'
raise 'unexpected steps' unless s.length==3
r={scope:'FRESH_SOURCE_YAML_EFFECT_ASSERTIONS_NOT_EXECUTION',parse:'PASS',trigger:t,permissions:d['permissions'],runner:j['runs-on'],timeoutMinutes:j['timeout-minutes'],actionPins:[s[0]['uses'],s[2]['uses']],exact17ExportEntries:actual,workflowWrites:false}
File.open(ARGV[1],File::WRONLY|File::CREAT|File::EXCL,0600){|f|f.write(JSON.pretty_generate(r)+"\n")}
puts JSON.generate({sourceYAML:'PASS',exactExports:actual.length})
