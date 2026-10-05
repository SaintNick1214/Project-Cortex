FIELDS=('dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns')
def fs_identity(stats):
 fields={}
 for key in FIELDS:
  value=getattr(stats,'st_'+key)
  if type(value) is not int or (value<0 and not key.endswith('_ns')):raise ValueError('QA_C7_EXACT_IDENTITY_SCHEMA')
  fields[key]=str(value)
 return {'schema':'FS_IDENTITY_DECIMAL_V1','fields':fields}

import json,re
SCHEMA='FS_IDENTITY_DECIMAL_V1'
AUTHORITY_KEYS={'identity','sourceIdentity','destinationIdentity','originalIdentity','producerIdentity','finalIdentity','pinIdentity'}
def validate(value):
 if type(value) is not dict or set(value)!={'schema','fields'} or value['schema']!=SCHEMA or type(value['fields']) is not dict or set(value['fields'])!=set(FIELDS):raise ValueError('QA_C7_EXACT_IDENTITY_SCHEMA')
 for key,token in value['fields'].items():
  if type(token) is not str or re.fullmatch(r'(?:0|[1-9][0-9]*|-[1-9][0-9]*)' if key.endswith('_ns') else r'(?:0|[1-9][0-9]*)',token) is None:raise ValueError('QA_C7_EXACT_IDENTITY_SCHEMA')
 return value
def pairs(rows):
 result={}
 for key,value in rows:
  if key in result:raise ValueError('QA_C7_JSON_DUPLICATE_KEY')
  result[key]=value
 return result
def constant(value):raise ValueError('QA_C7_NON_JSON_CONSTANT')
def loads(text):
 value=json.loads(text,object_pairs_hook=pairs,parse_constant=constant)
 def walk(item):
  if type(item) is dict:
   if item.get('schema')==SCHEMA:validate(item)
   for key,entry in item.items():
    if key in AUTHORITY_KEYS:validate(entry)
    walk(entry)
  elif type(item) is list:
   for entry in item:walk(entry)
 walk(value);return value
