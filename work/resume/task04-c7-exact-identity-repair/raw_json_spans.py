"""Strict forensic token spans. Numeric lexemes are never converted to numbers."""
import json,re
NUMBER=re.compile(r'-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?')
def identity_spans(data):
 text=data.decode('utf8');i=0;spans={};decoder=json.JSONDecoder()
 def ws():
  nonlocal i
  while i<len(text) and text[i] in ' \r\n\t':i+=1
 def take(c):
  nonlocal i
  ws()
  if i>=len(text) or text[i]!=c:raise ValueError('C7_FORENSIC_DELIMITER')
  i+=1
 def string():
  nonlocal i
  ws();value,end=decoder.raw_decode(text,i)
  if type(value) is not str:raise ValueError('C7_FORENSIC_STRING')
  i=end;return value
 def value(path):
  nonlocal i
  ws();start=i
  if text[i]=='{':
   i+=1;keys=set();ws()
   if text[i]!='}':
    while True:
     key=string()
     if key in keys:raise ValueError('C7_FORENSIC_DUPLICATE_KEY')
     keys.add(key);take(':');value(path+'.'+key);ws()
     if text[i]=='}':break
     take(',')
   take('}')
  elif text[i]=='[':
   i+=1;n=0;ws()
   if text[i]!=']':
    while True:
     value(path+'['+str(n)+']');n+=1;ws()
     if text[i]==']':break
     take(',')
   take(']')
  elif text[i]=='"':string()
  else:
   matched=False
   for token in ('true','false','null'):
    if text.startswith(token,i):i+=len(token);matched=True;break
   if not matched:
    m=NUMBER.match(text,i)
    if not m:raise ValueError('C7_FORENSIC_TOKEN')
    i=m.end()
  if path.endswith('.identity'):spans[path]=text[start:i]
 value('');ws()
 if i!=len(text):raise ValueError('C7_FORENSIC_EOF')
 return spans
