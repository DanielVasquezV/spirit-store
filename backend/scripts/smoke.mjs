/**
 * Smoke test end-to-end contra una instancia real de la API.
 *
 *   npm run dev            # en otra terminal
 *   npm run smoke          # aca
 *
 * Cubre los 11 endpoints de /api. No necesita framework de tests: son
 * aserciones sobre fetch, asi que corre en cualquier Node >= 18 sin instalar
 * nada extra. Sale con codigo 1 si algo falla, para poder engancharlo a CI.
 *
 * Los tests que dependen de Cloudinary se saltan (y lo dicen) cuando
 * CLOUDINARY_URL esta vacio: es preferible un "SKIP" visible a un falso verde.
 * Para correrlos: CLOUDINARY_URL=cloudinary://key:secret@cloud ponelo en ../.env
 */

import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// El .env vive en la raiz del monorepo, igual que hace el backend al arrancar.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../.env') });

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@spirit.dev';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'change-me';
const CLOUDINARY_CONFIGURED = Boolean(process.env.CLOUDINARY_URL);

// El secreto sale de la URL para poder verificar que NO se filtra en las
// respuestas. Vive solo en memoria, en este proceso de test.
const CLOUDINARY_SECRET_FROM_URL = (() => {
  try {
    return new URL(process.env.CLOUDINARY_URL ?? '').password || '';
  } catch {
    return '';
  }
})();

let pass = 0;
let fail = 0;
let skip = 0;
const created = [];

function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  ok     ${name}`); }
  else { fail += 1; console.log(`  FALLA  ${name}${extra ? `  -> ${extra}` : ''}`); }
}

function skipTest(name, why) {
  skip += 1;
  console.log(`  skip   ${name}  (${why})`);
}

function section(title) { console.log(`\n== ${title} ==`); }

/**
 * Status que se observaron de verdad en cada operacion, para cruzarlos contra
 * lo que declara el spec. Se llena solo en `req()`, asi que cubre todo lo que
 * los tests de arriba ya prueban sin duplicar assertions.
 */
const observed = new Map();

async function req(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });

  // La clave tiene que coincidir con la del spec: sin query string y con los
  // parametros de ruta en la notacion de OpenAPI. Los ids concretos se
  // normalizan a {id} para que el mismo endpoint colapse en una sola clave.
  const routePath = path
    .split('?')[0]
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}');
  const key = `${method} /api${routePath === '/' ? '' : routePath}`;
  if (!observed.has(key)) observed.set(key, new Set());
  observed.get(key).add(res.status);

  let json = null;
  try { json = await res.json(); } catch { /* respuesta sin cuerpo */ }
  return { status: res.status, json };
}

/** PNG 1x1 valido, para los tests de upload. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const uniqueEmail = (tag) => `smoke.${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@spirit.dev`;

// ---------------------------------------------------------------------------

section('GET /api/health');
{
  const r = await req('GET', '/health');
  check('200', r.status === 200, `fue ${r.status}`);
  check('envelope success', r.json?.success === true);
  check('status ok', r.json?.data?.status === 'ok');
  check('sin token', r.json?.data?.service === 'spiritapex-api');
}

section('POST /api/auth/register');
const regEmail = uniqueEmail('reg');
const regPhone = '+54 9 11 1234-5678';
let regToken = '';
let regUser = null;
{
  const r = await req('POST', '/auth/register', {
    body: { email: regEmail, password: 'Correcto1!', fullName: 'Smoke Test', phone: regPhone },
  });
  check('201', r.status === 201, `fue ${r.status} ${JSON.stringify(r.json)}`);
  const d = r.json?.data ?? {};
  regToken = d.accessToken ?? '';
  regUser = d.user ?? null;
  created.push(regEmail);
  check('accessToken string', typeof regToken === 'string' && regToken.split('.').length === 3);
  check('tokenType Bearer', d.tokenType === 'Bearer');
  check('expiresIn presente', Boolean(d.expiresIn));
  check('id uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(regUser?.id ?? ''));
  check('phoneNumber devuelto', regUser?.phoneNumber === regPhone, `llego ${regUser?.phoneNumber}`);
  check('rol inicial BUYER', regUser?.role === 'BUYER');
  check('NO expone passwordHash', !JSON.stringify(r.json).includes('$2b$'));
}

section('POST /api/auth/register (validacion)');
{
  const cases = [
    ['body vacio', {}, 'email'],
    ['email invalido', { email: 'no-es-mail', password: 'Correcto1!', fullName: 'Ana', phone: regPhone }, 'email'],
    ['password corta', { email: uniqueEmail('a'), password: 'corta', fullName: 'Ana', phone: regPhone }, 'password'],
    ['fullName corta', { email: uniqueEmail('b'), password: 'Correcto1!', fullName: 'A', phone: regPhone }, 'fullName'],
    ['sin telefono', { email: uniqueEmail('c'), password: 'Correcto1!', fullName: 'Ana' }, 'phone'],
    ['telefono vacio', { email: uniqueEmail('d'), password: 'Correcto1!', fullName: 'Ana', phone: '' }, 'phone'],
    ['telefono basura', { email: uniqueEmail('e'), password: 'Correcto1!', fullName: 'Ana', phone: 'abc' }, 'phone'],
  ];
  for (const [label, body, field] of cases) {
    const r = await req('POST', '/auth/register', { body });
    check(`${label} -> 400`, r.status === 400, `fue ${r.status}`);
    check(`  ...detalle en "${field}"`, Boolean(r.json?.error?.details?.[field]),
      `llegan ${Object.keys(r.json?.error?.details ?? {}).join(',')}`);
  }
  const dup = await req('POST', '/auth/register', {
    body: { email: regEmail.toUpperCase(), password: 'Otro1234!', fullName: 'Ana', phone: regPhone },
  });
  check('email duplicado (case-insensitive) -> 409', dup.status === 409, `fue ${dup.status}`);
  check('409 no filtra hash', !JSON.stringify(dup.json).includes('$2b$'));
}

section('POST /api/auth/login');
{
  const ok = await req('POST', '/auth/login', { body: { email: regEmail, password: 'Correcto1!' } });
  check('credenciales correctas -> 200', ok.status === 200, `fue ${ok.status}`);
  check('devuelve token', typeof ok.json?.data?.accessToken === 'string');
  check('no expone hash', !JSON.stringify(ok.json).includes('$2b$'));

  const bad = await req('POST', '/auth/login', { body: { email: regEmail, password: 'Incorrecta1!' } });
  const ghost = await req('POST', '/auth/login', { body: { email: uniqueEmail('ghost'), password: 'Incorrecta1!' } });
  check('password incorrecta -> 401', bad.status === 401, `fue ${bad.status}`);
  check('usuario inexistente -> 401', ghost.status === 401, `fue ${ghost.status}`);
  check('mismo mensaje (anti-enumeracion)', bad.json?.error?.message === ghost.json?.error?.message,
    `"${bad.json?.error?.message}" vs "${ghost.json?.error?.message}"`);
}

section('GET /api/auth/me');
{
  const r = await req('GET', '/auth/me', { token: regToken });
  check('200', r.status === 200, `fue ${r.status}`);
  check('email correcto', r.json?.data?.email === regEmail);
  check('trae duiPhotoUrl', 'duiPhotoUrl' in (r.json?.data ?? {}));
  check('NO expone passwordHash', !JSON.stringify(r.json).includes('$2b$'));

  const noAuth = await req('GET', '/auth/me');
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);
  const badToken = await req('GET', '/auth/me', { token: 'no.es.un.jwt' });
  check('token invalido -> 401', badToken.status === 401, `fue ${badToken.status}`);
}

section('PATCH /api/auth/me');
{
  const esc = await req('PATCH', '/auth/me', { token: regToken, body: { role: 'ADMIN' } });
  check('role ADMIN -> 403 (anti autoescalada)', esc.status === 403, `fue ${esc.status}`);
  const after = await req('GET', '/auth/me', { token: regToken });
  check('rol sigue BUYER', after.json?.data?.role === 'BUYER', `quedo ${after.json?.data?.role}`);

  const seller = await req('PATCH', '/auth/me', { token: regToken, body: { role: 'SELLER' } });
  check('BUYER -> SELLER = 200', seller.status === 200, `fue ${seller.status}`);
  const buyer = await req('PATCH', '/auth/me', { token: regToken, body: { role: 'BUYER' } });
  check('SELLER -> BUYER = 200', buyer.status === 200, `fue ${buyer.status}`);
  const badRole = await req('PATCH', '/auth/me', { token: regToken, body: { role: 'GOD' } });
  check('rol invalido -> 400', badRole.status === 400, `fue ${badRole.status}`);

  const clearPhone = await req('PATCH', '/auth/me', { token: regToken, body: { phone: '' } });
  check('no se puede vaciar el telefono -> 400', clearPhone.status === 400, `fue ${clearPhone.status}`);
  const nullPhone = await req('PATCH', '/auth/me', { token: regToken, body: { phoneNumber: null } });
  check('phoneNumber null -> 400', nullPhone.status === 400, `fue ${nullPhone.status}`);

  const extUrl = await req('PATCH', '/auth/me', { token: regToken, body: { duiPhotoUrl: 'https://evil.com/x.jpg' } });
  check('duiPhotoUrl no-Cloudinary -> 400', extUrl.status === 400, `fue ${extUrl.status}`);

  const partial = await req('PATCH', '/auth/me', { token: regToken, body: { fullName: 'Smoke Actualizado' } });
  check('PATCH parcial = 200', partial.status === 200, `fue ${partial.status}`);
  check('  ...aplica fullName', partial.json?.data?.fullName === 'Smoke Actualizado');
  check('  ...no toca phoneNumber', partial.json?.data?.phoneNumber === regPhone,
    `quedo ${partial.json?.data?.phoneNumber}`);
  check('  ...no toca role', partial.json?.data?.role === 'BUYER');
}

section('POST /api/uploads/sign');
{
  const noAuth = await req('POST', '/uploads/sign', { body: { kind: 'vehicles', contentType: 'image/jpeg' } });
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  if (!CLOUDINARY_CONFIGURED) {
    const r = await req('POST', '/uploads/sign', { token: regToken, body: { kind: 'vehicles', contentType: 'image/jpeg' } });
    check('sin credenciales -> 503', r.status === 503, `fue ${r.status}`);
    skipTest('firma real', 'CLOUDINARY_URL vacio');
  } else {
    const r = await req('POST', '/uploads/sign', { token: regToken, body: { kind: 'vehicles', contentType: 'image/jpeg' } });
    check('200', r.status === 200, `fue ${r.status} ${JSON.stringify(r.json)}`);
    const s = r.json?.data ?? {};
    check('devuelve signature', typeof s.signature === 'string' && s.signature.length > 20);
    // Comprobar `typeof === 'string'` no alcanza: el string vacio lo pasa, y una
    // config de Cloudinary vacia es exactamente lo que rompia este endpoint.
    check('devuelve apiKey con contenido', typeof s.apiKey === 'string' && s.apiKey.length > 10,
      `llego "${s.apiKey}"`);
    check('devuelve cloudName con contenido', typeof s.cloudName === 'string' && s.cloudName.length > 2,
      `llego "${s.cloudName}"`);
    check('devuelve folder', typeof s.folder === 'string' && s.folder.includes('vehicles'));
    check('devuelve timestamp numerico', Number.isFinite(s.timestamp));
    // El secreto no puede viajar al movil: la app solo necesita la api key
    // publica para firmar. Se busca la clave y ademas se busca el valor real
    // del secreto (sacado del env) dentro del JSON de la respuesta.
    check('sin clave apiSecret en la respuesta', !('apiSecret' in s));
    const realSecret = CLOUDINARY_SECRET_FROM_URL;
    check('el secreto real no aparece en el JSON',
      Boolean(realSecret) && !JSON.stringify(r.json).includes(realSecret),
      `no se pudo extraer el secreto de CLOUDINARY_URL (valor: "${realSecret}")`);
  }
  const badKind = await req('POST', '/uploads/sign', { token: regToken, body: { kind: '../../etc', contentType: 'image/jpeg' } });
  check('kind invalido -> 400', badKind.status === 400, `fue ${badKind.status}`);
}

section('POST /api/uploads (multipart)');
let uploadedPublicId = '';
{
  const noAuth = new FormData();
  noAuth.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'x.png');
  const r0 = await req('POST', '/uploads', { form: noAuth });
  check('sin token -> 401', r0.status === 401, `fue ${r0.status}`);

  const badMime = new FormData();
  badMime.append('file', new Blob([Buffer.from('#!/bin/sh')], { type: 'application/x-sh' }), 'x.sh');
  const r1 = await req('POST', '/uploads', { token: regToken, form: badMime });
  check('mime no permitido -> 415', r1.status === 415, `fue ${r1.status}`);

  if (!CLOUDINARY_CONFIGURED) {
    const f = new FormData();
    f.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'x.png');
    const r2 = await req('POST', '/uploads', { token: regToken, form: f });
    check('sin credenciales -> 503', r2.status === 503, `fue ${r2.status}`);
    skipTest('subida real', 'CLOUDINARY_URL vacio');
  } else {
    const f = new FormData();
    f.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'smoke.png');
    f.append('kind', 'vehicles');
    const r2 = await req('POST', '/uploads', { token: regToken, form: f });
    // 201: se creo un recurso nuevo, no 200.
    check('201', r2.status === 201, `fue ${r2.status} ${JSON.stringify(r2.json)}`);
    const u = r2.json?.data ?? {};
    uploadedPublicId = u.publicId ?? '';
    check('devuelve url https', String(u.url).startsWith('https://res.cloudinary.com/'), `url ${u.url}`);
    check('devuelve publicId', typeof uploadedPublicId === 'string' && uploadedPublicId.includes('vehicles'));
    check('publicId con folder + usuario', uploadedPublicId.split('/').length >= 3, uploadedPublicId);
    check('publicId sin extension duplicada', !/\.[a-z0-9]+\.[a-z0-9]+$/.test(u.url),
      `la url trae doble extension: ${u.url}`);
    check('la url termina en una sola extension', /\.[a-z0-9]+$/.test(String(u.url)), `url ${u.url}`);
    check('devuelve bytes', Number.isFinite(u.bytes) && u.bytes > 0);
    check('devuelve width/height', Number.isFinite(u.width) && Number.isFinite(u.height));
    check('devuelve resourceType image', u.resourceType === 'image');
  }
}

section('Subida directa a Cloudinary con la firma (sin pasar por la API)');
{
  // Es el flujo que la app va a usar en las galerias: pedir la firma, subir el
  // archivo directo a Cloudinary y guardar el publicId. Probar solo que la
  // firma "se ve bien" no alcanza: si la transformacion firmada no coincide con
  // la que Cloudinary aplica, la subida se rechaza con un 400 sin explicación.
  if (!CLOUDINARY_CONFIGURED) {
    skipTest('subida firmada', 'CLOUDINARY_URL vacio');
  } else {
    const s = await req('POST', '/uploads/sign', { token: regToken, body: { kind: 'vehicles', contentType: 'image/png' } });
    if (s.status !== 200) {
      skipTest('subida firmada', `no se pudo obtener la firma (${s.status})`);
    } else {
      const p = s.json.data;
      const form = new FormData();
      form.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'directa.png');
      form.append('api_key', p.apiKey);
      form.append('timestamp', String(p.timestamp));
      form.append('signature', p.signature);
      form.append('folder', p.folder);
      form.append('transformation', p.transformation);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${p.cloudName}/image/upload`, {
        method: 'POST', body: form,
      });
      const json = await res.json().catch(() => ({}));
      check('Cloudinary acepta la firma -> 200', res.status === 200,
        `fue ${res.status}: ${JSON.stringify(json?.error?.message ?? json)}`);
      check('el asset queda en la carpeta firmada',
        String(json?.public_id ?? '').startsWith(p.folder),
        `public_id ${json?.public_id} vs folder ${p.folder}`);

      if (res.status === 200) {
        // Y se limpia desde la API, que es el otro camino que usa la app.
        const del = await req('DELETE', `/uploads?publicId=${encodeURIComponent(json.public_id)}&kind=vehicles`, { token: regToken });
        check('el publicId firmado se puede borrar desde la API', del.status === 204, `fue ${del.status}`);
      }
    }
  }
}

section('DELETE /api/uploads');
{
  const noAuth = await req('DELETE', '/uploads?publicId=spiritapex%2Fvehicles%2Fx.jpg&kind=vehicles');
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const missing = await req('DELETE', '/uploads?kind=vehicles', { token: regToken });
  check('sin publicId -> 400', missing.status === 400, `fue ${missing.status}`);

  const outside = await req('DELETE', '/uploads?publicId=otraapp%2Fvehicles%2Fx.jpg&kind=vehicles', { token: regToken });
  check('folder ajeno -> 403', outside.status === 403, `fue ${outside.status}`);

  const traversal = await req('DELETE', `/uploads?publicId=${encodeURIComponent('spiritapex/../../etc/passwd')}&kind=vehicles`, { token: regToken });
  check('path traversal -> 400', traversal.status === 400, `fue ${traversal.status}`);

  if (!CLOUDINARY_CONFIGURED) {
    skipTest('borrado real', 'CLOUDINARY_URL vacio');
  } else if (!uploadedPublicId) {
    skipTest('borrado real', 'no se pudo subir el archivo antes');
  } else {
    // 204: no hay cuerpo, el borrado no "devuelve" nada. Y debe ser idempotente,
    // porque la app puede reintentar cuando la red se corta.
    const del = await req('DELETE', `/uploads?publicId=${encodeURIComponent(uploadedPublicId)}&kind=vehicles`, { token: regToken });
    check('borrado propio -> 204', del.status === 204, `fue ${del.status} ${JSON.stringify(del.json)}`);
    const again = await req('DELETE', `/uploads?publicId=${encodeURIComponent(uploadedPublicId)}&kind=vehicles`, { token: regToken });
    check('borrar dos veces es idempotente', again.status === 204, `fue ${again.status}`);
  }
}

section('GET/POST /api/users (requiere ADMIN)');
let adminToken = '';
{
  const login = await req('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (login.status !== 200) {
    skipTest('endpoints de admin', `no se pudo loguear como ${ADMIN_EMAIL} (${login.status})`);
  } else {
    adminToken = login.json?.data?.accessToken ?? '';
    const forbidden = await req('GET', '/users', { token: regToken });
    check('BUYER recibe 403', forbidden.status === 403, `fue ${forbidden.status}`);

    const list = await req('GET', '/users', { token: adminToken });
    check('ADMIN lista -> 200', list.status === 200, `fue ${list.status}`);
    const rows = list.json?.data ?? [];
    check('devuelve array', Array.isArray(rows) && rows.length > 0, `llego ${typeof rows}`);
    check('la lista NO expone passwordHash', !JSON.stringify(list.json).includes('$2b$'));
    check('la lista NO expone phoneNumber', !JSON.stringify(rows).includes(regPhone));
    check('el admin seed esta en la lista', rows.some((u) => u.email === ADMIN_EMAIL));

    const detail = await req('GET', `/users/${regUser?.id}`, { token: regToken });
    check('GET /users/:id por cualquier autenticado -> 200', detail.status === 200, `fue ${detail.status}`);
    check('detalle NO expone hash', !JSON.stringify(detail.json).includes('$2b$'));
    check('detalle NO expone phoneNumber', !JSON.stringify(detail.json).includes(regPhone));
    const notFound = await req('GET', '/users/00000000-0000-0000-0000-000000000000', { token: regToken });
    check('uuid inexistente -> 404', notFound.status === 404, `fue ${notFound.status}`);

    const newEmail = uniqueEmail('admin');
    created.push(newEmail);
    const create = await req('POST', '/users', {
      token: adminToken,
      body: { email: newEmail, password: 'Generada1!', fullName: 'Creado Por Admin', phoneNumber: regPhone },
    });
    check('ADMIN crea usuario -> 201', create.status === 201, `fue ${create.status} ${JSON.stringify(create.json)}`);
    check('  ...respuesta es el usuario directo', typeof create.json?.data?.id === 'string',
      `llego ${JSON.stringify(Object.keys(create.json?.data ?? {}))}`);
    check('  ...acepta phoneNumber', create.json?.data?.phoneNumber === regPhone,
      `quedo ${create.json?.data?.phoneNumber}`);

    // El body puede traer role, pero createUser no lo lee: el rol lo fija el
    // servicio. Comprueba que ignorarlo es lo que pasa, no que se cuele un ADMIN.
    const evil = uniqueEmail('evil');
    created.push(evil);
    const escalate = await req('POST', '/users', {
      token: adminToken,
      body: { email: evil, password: 'Generada1!', fullName: 'Escalada', phoneNumber: regPhone, role: 'ADMIN' },
    });
    check('role en el body se ignora (nace BUYER)',
      escalate.status === 201 && escalate.json?.data?.role === 'BUYER',
      `status ${escalate.status}, rol ${escalate.json?.data?.role}`);

    // Regresión: el alta de admin usaba `password.length < 8` en vez de
    // validatePassword(), y se comía el tope de 72 bytes de bcrypt. Más allá de
    // ese punto trunca en silencio y dos contraseñas distintas dan el mismo
    // hash, así que el usuario cree haber puesto algo que en realidad se
    // ignoró.
    const longPass = uniqueEmail('longpass');
    const tooLong = await req('POST', '/users', {
      token: adminToken,
      body: { email: longPass, password: 'A'.repeat(80) + '!', fullName: 'Pass Larga' },
    });
    check('password >72 bytes (tope bcrypt) -> 400', tooLong.status === 400,
      `fue ${tooLong.status} ${JSON.stringify(tooLong.json)}`);

    const shortPass = uniqueEmail('shortpass');
    const tooShort = await req('POST', '/users', {
      token: adminToken,
      body: { email: shortPass, password: 'Corta1!', fullName: 'Pass Corta' },
    });
    check('password <8 caracteres -> 400', tooShort.status === 400,
      `fue ${tooShort.status} ${JSON.stringify(tooShort.json)}`);

    const okEmail = uniqueEmail('okpass');
    created.push(okEmail);
    const okPass = await req('POST', '/users', {
      token: adminToken,
      body: { email: okEmail, password: 'Correcta1!', fullName: 'Pass Valida' },
    });
    check('password valida -> 201', okPass.status === 201, `fue ${okPass.status}`);
  }
}

section('Documentacion OpenAPI (/docs, /docs.json)');
{
  const origin = BASE.replace(/\/api\/?$/, '');
  const spec = await fetch(`${origin}/docs.json`);
  const doc = await spec.json();

  check('/docs.json responde 200', spec.status === 200, `fue ${spec.status}`);
  check('openapi 3.x', /^3\./.test(doc?.openapi ?? ''), `version ${doc?.openapi}`);
  check('tiene info.title', Boolean(doc?.info?.title));
  check('declara el esquema bearer', Boolean(doc?.components?.securitySchemes?.bearerAuth));

  // Cada $ref escrito a mano es un typo esperando: si no resuelve, la UI de
  // Swagger renderiza un panel vacio sin avisar.
  const refs = [];
  (function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === '$ref' && typeof v === 'string') refs.push(v);
        else walk(v);
      }
    }
  })(doc);

  check('el spec usa $ref', refs.length > 0, 'no se encontro ningun $ref');
  const dangling = refs.filter((r) => {
    if (!r.startsWith('#/')) return true;
    let cur = doc;
    for (const seg of r.slice(2).split('/')) {
      if (cur == null || !(seg in cur)) return true;
      cur = cur[seg];
    }
    return false;
  });
  check(`los ${refs.length} $ref resuelven`, dangling.length === 0, `rotos: ${dangling.join(', ')}`);

  // Deriva: si se agrega una ruta y no se documenta, este test falla. Se leen
  // los archivos de rutas en vez de mantener a mano una lista de endpoints
  // (que es justamente lo que se desactualiza en silencio) y en vez de
  // inspeccionar el router de Express, que en la v5 expone internals que no
  // dicen el prefijo de montaje.
  const documented = new Set(Object.keys(doc?.paths ?? {}));
  const declared = [];  try {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { resolve: r, dirname: d } = await import('node:path');
    const root = r(here, '..');

    const index = readFileSync(r(root, 'src/routes/index.ts'), 'utf8');
    // router.use('/auth', authRoutes)  ->  authRoutes se monta en /api/auth
    const mounts = new Map();
    for (const m of index.matchAll(/router\.use\(\s*'(\/[^']*)'\s*,\s*(\w+)/g)) {
      mounts.set(m[2], `/api${m[1]}`);
    }
    for (const m of index.matchAll(/router\.use\(\s*'(\/[^']*)'\s*,\s*(\w+)/g)) void m;

    // Las rutas declaradas dentro del propio index cuelgan de /api.
    for (const m of index.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      declared.push(`/api${m[2] === '/' ? '' : m[2]}`);
    }

    const modulesDir = r(root, 'src/modules');
    for (const mod of readdirSync(modulesDir, { withFileTypes: true })) {
      if (!mod.isDirectory()) continue;
      const files = readdirSync(r(modulesDir, mod.name));
      for (const file of files) {
        if (!file.endsWith('.routes.ts')) continue;
        const src = readFileSync(r(modulesDir, mod.name, file), 'utf8');
        // El nombre del router importado en routes/index.ts.
        const imported = index.match(new RegExp(`import\\s+(\\w+)\\s+from\\s+'\\.\\./modules/${mod.name}/`));
        const prefix = imported ? (mounts.get(imported[1]) ?? null) : null;
        if (prefix === null) continue;
        for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
          declared.push(`${prefix}${m[2] === '/' ? '' : m[2]}`);
        }
      }
    }
    // La raiz la declara app.ts con app.get('/'), no con un router montado.
    const appSrc = readFileSync(r(root, 'src/app.ts'), 'utf8');
    for (const m of appSrc.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      declared.push(m[2]);
    }
  } catch (err) {
    skipTest('deriva rutas vs spec', `no se pudieron leer las rutas: ${err.message}`);
  }

  // Express escribe los parametros de ruta como `:id`; OpenAPI como `{id}`.
  // Sin esta normalizacion las dos listas nunca coinciden.
  const toOpenApiPath = (p) => p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  const normalized = [...new Set(declared)].map(toOpenApiPath);

  const undocumented = normalized.filter((p) => !documented.has(p));
  const phantom = [...documented]
    .filter((p) => !p.startsWith('/docs'))
    .filter((p) => !normalized.includes(p));
  check(
    `las ${normalized.length} rutas del codigo estan documentadas`,
    undocumented.length === 0,
    undocumented.length ? `sin documentar: ${undocumented.join(', ')}` : '',
  );
  check('el spec no documenta rutas inexistentes', phantom.length === 0,
    phantom.length ? `fantasmas: ${phantom.join(', ')}` : '');

  // El spec tiene que describir los status que la API devuelve de verdad. Un
  // 200 documentado donde la API responde 201 hace que el cliente mal escrito
  //   nunca falle en local, que es la forma mas cara de romper algo sin notarse.
  const statusMismatch = [];
  for (const [key, statuses] of observed) {
    const space = key.indexOf(' ');
    const method = key.slice(0, space);
    const path = key.slice(space + 1);
    const op = doc?.paths?.[path]?.[method.toLowerCase()];
    if (!op) { statusMismatch.push(`${key}: no esta en el spec`); continue; }
    for (const status of statuses) {
      if (!(String(status) in (op.responses ?? {}))) {
        statusMismatch.push(`${key} -> ${status} (el spec declara ${Object.keys(op.responses).join(', ')})`);
      }
    }
  }
  check(
    `los ${observed.size} endpoints probados declaran su status real`,
    statusMismatch.length === 0,
    statusMismatch.join(' | '),
  );

  const html = await fetch(`${origin}/docs/`);
  const body = await html.text();
  check('/docs responde 200', html.status === 200, `fue ${html.status}`);
  check('/docs renderiza Swagger UI', /swagger-ui/i.test(body));
}

section('Socket.IO (handshake)');
{
  const { io } = await import('socket.io-client');
  const connect = (token) => new Promise((resolve) => {
    const socket = io(BASE.replace('/api', ''), {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
      timeout: 5000,
    });
    const done = (v) => { socket.close(); resolve(v); };
    socket.on('connection:ready', () => done({ ok: true }));
    socket.on('connect_error', (e) => done({ ok: false, message: e.message }));
    setTimeout(() => done({ ok: false, message: 'timeout' }), 6000);
  });

  const anon = await connect(undefined);
  check('sin token -> rechaza', anon.ok === false, JSON.stringify(anon));
  const bad = await connect('no.es.un.jwt');
  check('token invalido -> rechaza', bad.ok === false, JSON.stringify(bad));
  const good = await connect(regToken);
  check('token valido -> connection:ready', good.ok === true, JSON.stringify(good));
}

// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(52)}`);
console.log(`  ${pass} ok  |  ${fail} fallas  |  ${skip} omitidos`);
console.log(`  base: ${BASE}`);
if (skip > 0) {
  console.log('  Omitidos por falta de CLOUDINARY_URL: ponela en ../.env y');
  console.log('  reinicia el servidor para ejercitar subida/firma/borrado reales.');
}
console.log(`${'='.repeat(52)}\n`);

// Limpieza. Los tests de auth y de admin crean usuarios reales, asi que sin
// esto cada corrida deja basura en la base. Se borran por prefijo, que es
// unico por corrida, y solo si el usuario lo pide.
if (process.env.SMOKE_CLEANUP === '0') {
  console.log('SMOKE_CLEANUP=0: se dejan los usuarios de prueba en la base.\n');
} else {
  try {
    const { prisma } = await import('../src/lib/prisma.js');
    const { count } = await prisma.user.deleteMany({ where: { email: { startsWith: 'smoke.' } } });
    await prisma.$disconnect();
    console.log(`Limpieza: ${count} usuario(s) smoke.* eliminados.\n`);
  } catch (err) {
    console.log(`No se pudo limpiar (el servidor de la API puede seguir usando la DB): ${err.message}\n`);
  }
}

process.exit(fail === 0 ? 0 : 1);
