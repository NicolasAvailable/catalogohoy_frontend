from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
import json,subprocess,math
root=Path(__file__).resolve().parent
W,H=1920,1200
im=Image.new('RGB',(W,H)); px=im.load()
for y in range(H):
 for x in range(W):
  a=math.exp(-(((x-350)/1000)**2+((y-140)/760)**2));b=math.exp(-(((x-1700)/850)**2+((y-1040)/600)**2));wave=0.5+0.5*math.sin(x/900+y/210)
  px[x,y]=(int(21+40*a+13*b),int(64+75*a+28*b+12*wave),int(164+70*a+47*b))
im=im.convert('RGBA');shadow=Image.new('RGBA',(W,H));d=ImageDraw.Draw(shadow);d.rounded_rectangle((118,130,1802,1120),radius=14,fill=(4,12,40,145));im=Image.alpha_composite(im,shadow.filter(ImageFilter.GaussianBlur(23)));d=ImageDraw.Draw(im);d.rounded_rectangle((120,110,1800,1095),radius=4,fill='#24272c');d.rectangle((120,150,1799,1090),fill=(0,0,0,0));d.rounded_rectangle((120,1080,1799,1094),radius=4,fill=(0,0,0,0));d.rectangle((120,1080,1799,1090),fill=(0,0,0,0))
for x,c in [(144,'#ff5f57'),(166,'#febc2e'),(188,'#28c840')]:d.ellipse((x-6,130-6,x+6,130+6),fill=c)
im.save(root/'frame.png')
data=json.loads((root/'capture.json').read_text());fs=data['frames'];duration=data['duration'];lines=['ffconcat version 1.0']
for i,f in enumerate(fs):
 delta=fs[i+1]['time']-f['time'] if i+1<len(fs) else .15
 lines += ["file '"+f['file']+"'",f'duration {max(.001,delta):.6f}']
lines += ["file '"+fs[-1]['file']+"'"]
(root/'frames.ffconcat').write_text('\n'.join(lines))
# Smooth zooms with pauses; each move returns to the full desktop.
marks={v['name']:v['time'] for v in data['marks']}
def pulse(t0,t1,t2,t3):
 def ease(a,b):
  u=f'((on/30-{a})/{b-a})';return f'({u}*{u}*(3-2*{u}))'
 return f'if(lt(on/30,{t0}),0,if(lt(on/30,{t1}),{ease(t0,t1)},if(lt(on/30,{t2}),1,if(lt(on/30,{t3}),1-{ease(t2,t3)},0))))'
scenes=[(3.2,4.4,7.7,9.1,.29,.63,.36),(marks['search']-.4,marks['search']+.8,marks['reply']-.8,marks['reply']+.1,.32,.26,.35),(marks['reply']+.2,marks['reply']+1.4,marks['details']-.7,marks['details']+.4,.40,.61,1),(marks['details']+.6,marks['details']+1.5,marks['media']-.7,marks['media']+.3,.32,1,.65),(marks['media']+.6,marks['media']+1.6,marks['outro']-.6,marks['outro']+.8,.28,.63,.46)]
z='1' ;xx='0.5';yy='0.5'
for a,b,c,e,amount,fx,fy in scenes:
 p=pulse(a,b,c,e);z+=f'+{amount}*({p})';xx+=f'+{fx-.5}*({p})';yy+=f'+{fy-.5}*({p})'
filters=f"[0:v]fps=30,tpad=stop_mode=clone:stop_duration=3,scale=1680:945:flags=lanczos,pad=1920:1200:120:150[screen];[screen][1:v]overlay=0:0:format=auto,zoompan=z='{z}':x='(iw-iw/zoom)*({xx})':y='(ih-ih/zoom)*({yy})':d=1:s=1920x1200:fps=30,format=yuv420p[v]"
(root/'filter.txt').write_text(filters)
out=root.parent.parent/'catalogohoy-crm-desktop-zoom-sin-voz.mp4'
subprocess.run(['/opt/homebrew/bin/ffmpeg','-y','-hide_banner','-loglevel','error','-safe','0','-f','concat','-i',str(root/'frames.ffconcat'),'-i',str(root/'frame.png'),'-filter_complex_script',str(root/'filter.txt'),'-map','[v]','-an','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','17','-movflags','+faststart',str(out)],check=True)
print(out)
