import http.client,socket,json,sys
class Local(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(60);self.sock.connect('/etc/1panel/agent.sock')
def call(path,data=None,method='POST'):
 c=Local('localhost');c.request(method,'/api/v2/'+path,json.dumps(data) if data is not None else None,{'Content-Type':'application/json'});r=c.getresponse();d=json.loads(r.read());c.close()
 if d.get('code')!=200:raise RuntimeError(d.get('message'))
 return d
if __name__=='__main__':
 result=call(sys.argv[1],json.loads(sys.argv[2]) if len(sys.argv)>2 else None)
 print('Panel operation result:',result['code'])
