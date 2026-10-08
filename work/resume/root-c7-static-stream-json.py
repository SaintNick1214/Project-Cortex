"""Bounded complete JSON values with duplicate rejection at every object layer."""
import json,math
def pairs(rows):
 result={}
 for key,value in rows:
  if key in result:raise ValueError('C7_DUPLICATE_JSON_KEY '+key)
  result[key]=value
 return result
def constant(value):raise ValueError('C7_NON_JSON_CONSTANT '+value)
def floating(value):
 result=float(value)
 if not math.isfinite(result):raise ValueError('C7_NON_FINITE_JSON_NUMBER')
 return result
decoder=json.JSONDecoder(object_pairs_hook=pairs,parse_constant=constant,parse_float=floating)
def loads(text):return json.loads(text,object_pairs_hook=pairs,parse_constant=constant,parse_float=floating)
class Reader:
 def __init__(self,chunks,valueLimit=65536):
  self.chunks=iter(chunks);self.text='';self.at=0;self.done=False;self.valueLimit=valueLimit;self.peakBuffer=0;self.maxValueBytes=0
 def more(self):
  if self.done:return False
  if self.at:self.text=self.text[self.at:];self.at=0
  try:chunk=next(self.chunks)
  except StopIteration:self.done=True;return False
  # Transport producers explicitly use ensure_ascii=True. Non-ASCII bytes are
  # rejected, rather than silently decoding an incomplete UTF-8 fragment.
  self.text+=chunk.decode('ascii');self.peakBuffer=max(self.peakBuffer,len(self.text));return True
 def whitespace(self):
  while True:
   while self.at<len(self.text) and self.text[self.at] in ' \r\n\t':self.at+=1
   if self.at<len(self.text) or not self.more():return
 def peek(self):
  self.whitespace();return self.text[self.at] if self.at<len(self.text) else ''
 def char(self,expected):
  if self.peek()!=expected:raise ValueError('C7_JSON_DELIMITER '+expected)
  self.at+=1
 def value(self):
  self.whitespace()
  while True:
   try:value,end=decoder.raw_decode(self.text,self.at)
   except json.JSONDecodeError:
    if len(self.text)-self.at>self.valueLimit or not self.more():raise
    continue
   if end==len(self.text) and not self.done:
    if end-self.at>self.valueLimit:raise ValueError('C7_JSON_VALUE_CAP')
    self.more();continue
   if type(value) in (int,float) and end<len(self.text) and self.text[end] not in ' \r\n\t,]}':
    if not self.done and self.more():continue
    raise ValueError('C7_MALFORMED_JSON_NUMBER')
   if end-self.at>self.valueLimit:raise ValueError('C7_JSON_VALUE_CAP')
   self.maxValueBytes=max(self.maxValueBytes,end-self.at);self.at=end;return value
 def top(self,arrayKeys=(),objectKeys=(),item=lambda *args:None,pair=lambda *args:None):
  self.char('{');keys=set();small={}
  if self.peek()=='}':
   self.at+=1
   if self.peek():raise ValueError('C7_JSON_TRAILING_BYTES')
   return small
  while True:
   key=self.value()
   if type(key) is not str or key in keys:raise ValueError('C7_DUPLICATE_TOP_KEY')
   keys.add(key);self.char(':')
   if key in arrayKeys:
    self.char('[')
    if self.peek()!=']':
     while True:
      item(key,self.value())
      if self.peek()==']':break
      self.char(',')
    self.char(']')
   elif key in objectKeys:
    self.char('{');seen=set()
    if self.peek()!='}':
     while True:
      name=self.value()
      if type(name) is not str or name in seen:raise ValueError('C7_DUPLICATE_STREAM_OBJECT_KEY')
      seen.add(name);self.char(':');pair(key,name,self.value())
      if self.peek()=='}':break
      self.char(',')
    self.char('}')
   else:small[key]=self.value()
   if self.peek()=='}':break
   self.char(',')
  self.char('}')
  if self.peek():raise ValueError('C7_JSON_TRAILING_BYTES')
  return small
