FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def fs_identity(stats):
 fields={}
 for key in FIELDS:
  value=getattr(stats,'st_'+key)
  if type(value) is not int or (value<0 and not key.endswith('_ns')):raise ValueError('QA_C7_EXACT_IDENTITY_SCHEMA')
  fields[key]=str(value)
 return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':fields}
