import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const rows=new Set();
function visitFile(p){const sf=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true);function visit(n){let v; if(ts.isJsxText(n)) v=n.text; else if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))v=n.text;else if(ts.isTemplateExpression(n))v=n.head.text+n.templateSpans.map((s,i)=>`{${i}}`+s.literal.text).join('');
if(v){const attr=ts.findAncestor(n,a=>ts.isJsxAttribute(a));const skip=attr&&['className','d','fill','stroke','style','id','key','type','value','href','src','name','role','viewBox','transform','filter','points','data-testid'].includes(attr.name.getText(sf));const k=v.trim().replace(/\s+/g,' ');if(!skip&&/[A-Za-z]/.test(k)&&!/[=_<>\\]|https?:|url\(|rgba?\(|hsla?\(|\.\/|\.ts|^#[\da-f]|^[\w.-]+:|^[A-Z]\d|^\d/.test(k)&&!/^[-a-z0-9]+(?: [-a-z0-9]+)*$/.test(k)&&k.length<1000&&(!/[-a-z]+ [-a-z]+/.test(k)||/[A-Z.,!?°%]/.test(k)))rows.add(k)}ts.forEachChild(n,visit)}visit(sf)}
function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory()){if(f!=='i18n')walk(p)}else if(/\.tsx?$/.test(f))visitFile(p)}}walk('src');fs.writeFileSync('/tmp/aetheris-language-copy.json',JSON.stringify([...rows].sort(),null,2));console.log(rows.size);
