from pathlib import Path
N=Path(__file__).resolve().parents[1];p=N/'controls/repair_controls3.py';t=p.read_text();pos=t.index("output={'scope'")
extra='''
PUBLIC=tuple(ast.literal_eval(next(n.value for n in ast.parse((S/'native_export.py').read_bytes()).body if isinstance(n,ast.Assign)and any(isinstance(v,ast.Name)and v.id=='PUBLIC'for v in n.targets))))
P=definitions('public_export_contract.py',{'re':re,'FIELDS':('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'),'PUBLIC':PUBLIC,'ROOT':'/var/tmp/task04-c8-current-canonical-input-producers/'})
def public_fixture():
 fields={'dev':'1','ino':'2','mode':'33152','uid':'0','gid':'0','nlink':'1','size':'1','mtime_ns':'2','ctime_ns':'2'}
 pin={'schema':'FS_IDENTITY_DECIMAL_V1','fields':fields}
 current={'path':P['ROOT']+PUBLIC[0],'bytes':1,'sha256':'a'*64,'PRE':pin,'OPEN':copy.deepcopy(pin),'POST':copy.deepcopy(pin),'pathPOST':copy.deepcopy(pin),'EOF':True}
 files=[{'relativePath':name,'status':'ABSENT'}for name in PUBLIC]
 files[0]={'relativePath':PUBLIC[0],'status':'EXISTS','current':current}
 return {'scope':'FINITE_PUBLIC_SOURCE_CONTROL_EXPORT_ONLY','files':files,'fileCount':23,'existingBytes':1,'combinedExportBytesMaxIncludingThisManifest':1048576,
         'primaryFailure':None,'allDescendantsTerminal':True,'nativeClaims':False,'original122':'HELD','ROOT':'ABSENT'}
def public_positive():
 result=P['validate_public'](public_fixture());assert len(result)==23 and result[0]['current']['bytes']==1
 return {'strictPublic23':True,'unchangedSchema':True,'realExport':False}
case('public48-exact-unchanged-export-schema-positive',public_positive)
def public_mutation(path,value):
 data=public_fixture();obj=data
 for k in path[:-1]:obj=obj[k]
 obj[path[-1]]=value
 reason=deny(lambda:P['validate_public'](data))
 return {'deniedBeforeAnyExportMemberCopy':True,'field':str(path),'reason':reason}
for path,value in [(['nativeClaims'],0),(['allDescendantsTerminal'],1),(['fileCount'],23.0),(['existingBytes'],True),
 (['files',0,'current','bytes'],True),(['files',0,'current','EOF'],1),(['files',0,'current','POST','fields','ctime_ns'],'3'),
 (['files',0,'current','PRE','fields','ino'],2),(['files',0,'current','path'],'/foreign'),(['files',1,'relativePath'],PUBLIC[0])]:
 case('public48-export-denial-'+str(path),lambda path=path,value=value:public_mutation(path,value))

def capacity_conservation():
 ns={};tree=ast.parse((S/'native_contract.py').read_bytes())
 body=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.Assign)) and not (isinstance(n,ast.Assign)and any(isinstance(v,ast.Name)and v.id in ('ROOT','C7ROOT')for v in n.targets))]
 exec(compile(ast.Module(body=body,type_ignores=[]),'unchanged-native-contract','exec'),ns)
 host=ns['host_demand'](4096);container=ns['demand'](4096)
 assert host['initialAvailableBytesRequired']==13298642944 and host['initialAvailableInodesRequired']==131338
 assert container['initialAvailableBytesRequired']==2604023808 and container['initialAvailableInodesRequired']==21120
 assert ns['PY_RESERVE']==134217728 and ns['NODE_RESERVE']==536870912
 return {'hostAt4096':host,'containerAt4096':container,'capacityObserved':False,'maxOneOwnedVolumeFootprintAtATime':True}
case('literal-capacity-assertions-conserved',capacity_conservation,'STATIC')

'''
p.write_text(t[:pos]+extra+t[pos:])
