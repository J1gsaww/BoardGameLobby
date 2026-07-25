/* check-refs.mjs — จับตัวแปรกับฟังก์ชันที่ถูกเรียกแต่ไม่มีอยู่จริง
   รันด้วย  node check-refs.mjs

   ทำไมต้องมี: `node --check` ตรวจแค่ไวยากรณ์ ไม่ได้ตรวจว่าชื่อที่เรียกมีตัวตนไหม
   เวลารีแฟกเตอร์แล้วเผลอลบฟังก์ชันทิ้งไปพร้อมกับโค้ดที่ตั้งใจแทนที่
   ไฟล์จะยังผ่าน --check ทุกประการ แล้วไปพังตอนเปิดหน้าเว็บจริงเป็นจอแดง
   ซึ่งรู้ตัวช้ามาก เพราะต้อง push แล้วรอ deploy แล้วเปิดเบราว์เซอร์ถึงจะเจอ

   วิธีตรวจ: parse เป็น AST จริง ไล่ scope ทุกชั้น เก็บชื่อที่ประกาศไว้ทั้งหมด
   (ตัวแปร ฟังก์ชัน พารามิเตอร์ import การ destructure) แล้วดูว่ามีชื่อไหน
   ถูกอ่านโดยไม่เคยถูกประกาศและไม่ใช่ของที่เบราว์เซอร์มีให้ */

import { readFileSync, globSync } from 'node:fs';

/* acorn เป็นตัว parse ตัวเดียวที่ต้องลงเพิ่ม ถ้ายังไม่มีก็ข้ามไป ไม่ล้มทั้งชุด
   ลงด้วย  npm install acorn --no-save */
let parse;
try { ({ parse } = await import('acorn')); }
catch {
  console.log('ข้ามการตรวจ — ยังไม่มี acorn (ลงด้วย: npm install acorn --no-save)');
  process.exit(0);
}

/* ของที่เบราว์เซอร์กับ JS มีให้อยู่แล้ว ไม่ต้องประกาศ */
const GLOBALS = new Set([
  'window', 'document', 'console', 'location', 'navigator', 'history', 'screen',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'Image', 'Audio',
  'localStorage', 'sessionStorage', 'performance', 'crypto', 'matchMedia',
  'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData', 'Headers',
  'Math', 'JSON', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Set', 'Map', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'RegExp', 'Error',
  'TypeError', 'RangeError', 'Intl', 'Proxy', 'Reflect', 'BigInt', 'globalThis',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'structuredClone',
  'CustomEvent', 'Event', 'EventTarget', 'AbortController', 'IntersectionObserver',
  'ResizeObserver', 'MutationObserver', 'DOMParser', 'XMLHttpRequest',
  'AudioContext', 'webkitAudioContext', 'undefined', 'NaN', 'Infinity',
  'createImageBitmap', 'OffscreenCanvas', 'ImageData', 'Path2D', 'WebSocket',
  'arguments', 'this', 'super', 'import', 'HTMLElement', 'Node', 'Element',
  'getComputedStyle', 'alert', 'confirm', 'prompt', 'atob', 'btoa', 'TextEncoder',
  'TextDecoder', 'Uint8Array', 'ArrayBuffer', 'process', 'require', 'module'
]);

let bad = 0;

for (const file of globSync('js/**/*.js')) {
  const src = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (e) {
    console.log(`  ${file} → parse ไม่ผ่าน: ${e.message}`);
    bad++;
    continue;
  }

  /* scope เป็นชั้น ๆ ชั้นล่างเห็นชื่อของชั้นบนได้ */
  const declared = [new Set()];
  const used = [];   // { name, line }

  const declare = (name) => { if (name) declared[declared.length - 1].add(name); };
  const known = (name) => declared.some(s => s.has(name)) || GLOBALS.has(name);

  /* ดึงชื่อออกจากรูปแบบการประกาศทุกแบบ รวมถึง destructure ซ้อนชั้น */
  function names(node) {
    if (!node) return;
    switch (node.type) {
      case 'Identifier': declare(node.name); break;
      case 'ObjectPattern':
        for (const p of node.properties) {
          if (p.type === 'RestElement') names(p.argument);
          else names(p.value);
        }
        break;
      case 'ArrayPattern': node.elements.forEach(names); break;
      case 'AssignmentPattern': names(node.left); break;
      case 'RestElement': names(node.argument); break;
      default: break;
    }
  }

  /* เก็บชื่อที่ประกาศไว้ในบล็อกนี้ก่อน แล้วค่อยไล่ลงไปข้างใน
     ทำแบบนี้เพราะ function declaration กับ import ถูกยกขึ้นบนสุดของ scope */
  function hoist(body) {
    for (const n of body || []) {
      if (n.type === 'FunctionDeclaration') declare(n.id?.name);
      else if (n.type === 'ClassDeclaration') declare(n.id?.name);
      else if (n.type === 'VariableDeclaration') n.declarations.forEach(d => names(d.id));
      else if (n.type === 'ImportDeclaration') n.specifiers.forEach(sp => declare(sp.local.name));
      else if (n.type === 'ExportNamedDeclaration' && n.declaration) hoist([n.declaration]);
      else if (n.type === 'ExportDefaultDeclaration' && n.declaration?.id) declare(n.declaration.id.name);
    }
  }

  function walk(node, parent) {
    if (!node || typeof node.type !== 'string') return;

    const opensScope = /Function|ArrowFunctionExpression|CatchClause|ClassDeclaration|ClassExpression/.test(node.type);
    if (opensScope) {
      declared.push(new Set());
      if (node.id?.name) declare(node.id.name);
      (node.params || []).forEach(names);
      if (node.param) names(node.param);           // catch (e)
      if (node.body?.type === 'BlockStatement') hoist(node.body.body);
    } else if (node.type === 'BlockStatement') {
      declared.push(new Set());
      hoist(node.body);
    } else if (node.type === 'Program') {
      hoist(node.body);
    }

    /* ชื่อที่ถูก "อ่าน" เท่านั้นที่นับ — ชื่อ property กับ label ไม่นับ */
    if (node.type === 'Identifier' && parent) {
      const p = parent;
      const isProp = (p.type === 'MemberExpression' && p.property === node && !p.computed)
        || (p.type === 'Property' && p.key === node && !p.computed)
        || (p.type === 'MethodDefinition' && p.key === node)
        || p.type === 'LabeledStatement' || p.type === 'BreakStatement'
        || p.type === 'ContinueStatement' || p.type === 'ImportSpecifier'
        || p.type === 'ExportSpecifier';
      if (!isProp) used.push({ name: node.name, line: node.loc.start.line });
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const val = node[key];
      if (Array.isArray(val)) val.forEach(c => walk(c, node));
      else if (val && typeof val.type === 'string') walk(val, node);
    }

    if (opensScope || node.type === 'BlockStatement') declared.pop();
  }

  walk(ast, null);

  /* ตรวจตอนท้ายทีเดียว เพราะชื่ออาจถูกประกาศทีหลังในไฟล์เดียวกัน */
  const all = new Set();
  const collect = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') all.add(n.id?.name);
    if (n.type === 'VariableDeclarator') {
      const grab = (x) => {
        if (!x) return;
        if (x.type === 'Identifier') all.add(x.name);
        else if (x.type === 'ObjectPattern') x.properties.forEach(pp =>
          grab(pp.type === 'RestElement' ? pp.argument : pp.value));
        else if (x.type === 'ArrayPattern') x.elements.forEach(grab);
        else if (x.type === 'AssignmentPattern') grab(x.left);
        else if (x.type === 'RestElement') grab(x.argument);
      };
      grab(n.id);
    }
    if (n.type === 'ImportDeclaration') n.specifiers.forEach(sp => all.add(sp.local.name));
    if (/Function/.test(n.type)) {
      if (n.id?.name) all.add(n.id.name);
      (n.params || []).forEach(function p(x) {
        if (!x) return;
        if (x.type === 'Identifier') all.add(x.name);
        else if (x.type === 'ObjectPattern') x.properties.forEach(pp =>
          p(pp.type === 'RestElement' ? pp.argument : pp.value));
        else if (x.type === 'ArrayPattern') x.elements.forEach(p);
        else if (x.type === 'AssignmentPattern') p(x.left);
        else if (x.type === 'RestElement') p(x.argument);
      });
    }
    if (n.type === 'CatchClause' && n.param?.name) all.add(n.param.name);
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v.type === 'string') collect(v);
    }
  };
  collect(ast);

  const seen = new Set();
  for (const u of used) {
    if (all.has(u.name) || GLOBALS.has(u.name)) continue;
    const key = `${u.name}:${u.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${file}:${u.line} → เรียก \`${u.name}\` แต่ไม่มีที่ไหนประกาศไว้`);
    bad++;
  }
}

console.log(bad ? `\nพบ ${bad} จุดที่จะพังตอนรันจริง` : 'ทุกชื่อที่ถูกเรียกมีตัวตนครบ');
process.exit(bad ? 1 : 0);
