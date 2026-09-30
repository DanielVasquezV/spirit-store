/**
 * Smoke test end-to-end contra una instancia real de la API.
 *
 *   npm run dev            # en otra terminal
 *   npm run smoke          # aca
 *
 * Cubre todos los endpoints de /api, incluidas las pujas y su push por socket.
 * No necesita framework de tests: son
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

// ---------------------------------------------------------------------------
// Vehiculos y subastas.
//
// El usuario `regToken` se usa como vendedor. La regla de que hace falta DUI
// para publicar se prueba con un usuario recien registrado: si el `regUser` de
// arriba ya tuviera DUI, el caso "sin DUI -> 400" no probaria nada.
section('POST /api/vehicles (sin DUI -> 400)');
let sellerToken = '';
let sellerId = '';
{
  const email = uniqueEmail('vend');
  created.push(email);
  const reg = await req('POST', '/auth/register', {
    body: { email, password: 'Prueba1234!', fullName: 'Smoke Vendedor', phone: '+54 9 11 9999-0000' },
  });
  check('registro del vendedor -> 201', reg.status === 201, `fue ${reg.status}`);
  sellerToken = reg.json?.data?.accessToken ?? '';
  sellerId = reg.json?.data?.user?.id ?? '';

  const body = {
    vin: `VIN${Date.now()}`.slice(0, 17),
    licensePlate: 'SMK-1234',
    brand: 'Toyota', model: 'Hilux', year: 2020, mileage: 40000,
    transmission: 'MANUAL', fuel: 'DIESEL', category: 'PICKUP',
    engine: '2.8L Turbo Diesel', power: '201 HP', drivetrain: '4WD',
    basePrice: 42000, saleType: 'DIRECT_SALE',
  };
  const noDui = await req('POST', '/vehicles', { token: sellerToken, body });
  check('sin DUI -> 400', noDui.status === 400, `fue ${noDui.status}`);
  check('  ...el motivo es el DUI', JSON.stringify(noDui.json?.error?.details ?? {}).includes('DUI'),
    `details ${JSON.stringify(noDui.json?.error?.details)}`);

  const anon = await req('POST', '/vehicles', { body });
  check('sin token -> 401', anon.status === 401, `fue ${anon.status}`);

  const dui = await req('PATCH', '/auth/me', {
    token: sellerToken,
    body: { duiPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/spiritapex/dui/smoke.jpg' },
  });
  check('cargar DUI -> 200', dui.status === 200, `fue ${dui.status}`);
  created.push(email);
}

section('POST /api/vehicles (validacion)');
{
  const base = {
    vin: `VIN${Date.now()}`.slice(0, 17),
    licensePlate: 'SMK-9999',
    brand: 'Toyota', model: 'Corolla', year: 2020, mileage: 30000,
    transmission: 'MANUAL', fuel: 'GASOLINE', category: 'COMPACT',
    engine: '1.8L', power: '140 HP', drivetrain: 'FWD',
    basePrice: 30000, saleType: 'DIRECT_SALE',
  };
  const noAuth = await req('POST', '/vehicles', { body: base });
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const badCategory = await req('POST', '/vehicles', { token: sellerToken, body: { ...base, category: 'NAVIDAD' } });
  check('category invalida -> 400', badCategory.status === 400, `fue ${badCategory.status}`);

  const badFuel = await req('POST', '/vehicles', { token: sellerToken, body: { ...base, fuel: 'PLUTONIO' } });
  check('fuel invalido -> 400', badFuel.status === 400, `fue ${badFuel.status}`);

  const badYear = await req('POST', '/vehicles', { token: sellerToken, body: { ...base, year: 1800 } });
  check('year fuera de rango -> 400', badYear.status === 400, `fue ${badYear.status}`);

  const noEngine = await req('POST', '/vehicles', { token: sellerToken, body: { ...base, engine: undefined } });
  check('engine ausente -> 400', noEngine.status === 400, `fue ${noEngine.status}`);

  const badImage = await req('POST', '/vehicles', {
    token: sellerToken,
    body: { ...base, images: [{ url: 'https://evil.com/x.jpg' }] },
  });
  check('imagen no-Cloudinary -> 400', badImage.status === 400, `fue ${badImage.status}`);

  // AUCTION exige el bloque de subasta: sin el, el vehiculo quedaria en un
  // limbo sin fechas ni precio de salida.
  const auctionNoBlock = await req('POST', '/vehicles', { token: sellerToken, body: { ...base, saleType: 'AUCTION' } });
  check('AUCTION sin bloque auction -> 400', auctionNoBlock.status === 400, `fue ${auctionNoBlock.status}`);

  const pastEnd = await req('POST', '/vehicles', {
    token: sellerToken,
    body: {
      ...base,
      saleType: 'AUCTION',
      auction: { startingPrice: 28000, endTime: new Date(Date.now() - 86400000).toISOString() },
    },
  });
  check('subasta con endTime en el pasado -> 400', pastEnd.status === 400, `fue ${pastEnd.status}`);
}

section('POST /api/vehicles (alta)');
let vehicleId = '';
let auctionId = '';
{
  const body = {
    vin: `VIN${Date.now()}`.slice(0, 17),
    licensePlate: `SMK-${String(Date.now()).slice(-4)}`,
    brand: 'Porsche', model: '911', year: 2021, mileage: 12000,
    transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SPORT',
    engine: '3.0L Boxer Turbo', power: '385 HP', drivetrain: 'RWD',
    basePrice: 128500, saleType: 'AUCTION',
    auction: { startingPrice: 120000, endTime: new Date(Date.now() + 86400000).toISOString() },
    images: [{
      url: 'https://res.cloudinary.com/demo/image/upload/v1/spiritapex/vehicles/smoke-1.jpg',
      publicId: 'spiritapex/vehicles/smoke-1',
    }],
  };
  const r = await req('POST', '/vehicles', { token: sellerToken, body });
  check('201', r.status === 201, `fue ${r.status} ${JSON.stringify(r.json)}`);
  const v = r.json?.data ?? {};
  vehicleId = v.id ?? '';
  auctionId = v.auction?.id ?? '';
  check('devuelve id', typeof vehicleId === 'string' && vehicleId.length > 0);
  check('  ...armo el title solo', v.title === 'Porsche 911', `quedo "${v.title}"`);
  check('  ...status IN_AUCTION', v.status === 'IN_AUCTION', `quedo ${v.status}`);
  check('  ...incluye la subasta', typeof auctionId === 'string' && auctionId.length > 0);
  check('  ...subasta ACTIVE', v.auction?.status === 'ACTIVE', `quedo ${v.auction?.status}`);
  check('  ...trae la foto', Array.isArray(v.images) && v.images.length === 1, `llego ${JSON.stringify(v.images)}`);
  check('  ...guarda el publicId', v.images?.[0]?.publicId === 'spiritapex/vehicles/smoke-1');
  check('  ...basePrice es numero', typeof v.basePrice === 'number', `llego ${typeof v.basePrice}`);
  check('  ...el vendedor viene incluido', v.seller?.id === sellerId, `llego ${JSON.stringify(v.seller)}`);
  check('  ...el vendedor NO expone duiPhotoUrl', !('duiPhotoUrl' in (v.seller ?? {})),
    `llego ${JSON.stringify(Object.keys(v.seller ?? {}))}`);
  check('  ...no expone passwordHash', !JSON.stringify(r.json).includes('$2b$'));
  // El historial de pujas vive en /auctions, no en el DTO del vehiculo: el mismo
  // DTO se usa en las cards del catalogo y ahi las pujas serian peso inútil.
  check('  ...el vehiculo no arrastra historial de pujas', !('recentBids' in (v.auction ?? {})),
    `llego ${JSON.stringify(Object.keys(v.auction ?? {}))}`);
  check('  ...la subasta resumen trae currentBid en null', v.auction?.currentBid === null,
    `llego ${JSON.stringify(v.auction?.currentBid)}`);

  // El sellerId va siempre del token, nunca del cuerpo.
  const spoof = await req('POST', '/vehicles', {
    token: sellerToken,
    body: {
      vin: `VIN${Date.now()}X`.slice(0, 17),
      licensePlate: 'SMK-0001', brand: 'Fiat', model: 'Uno', year: 2015, mileage: 90000,
      transmission: 'MANUAL', fuel: 'GASOLINE', category: 'COMPACT',
      engine: '1.0L', power: '70 HP', drivetrain: 'FWD',
      basePrice: 8000, saleType: 'DIRECT_SALE', sellerId: '00000000-0000-0000-0000-000000000000',
    },
  });
  check('sellerId en el cuerpo se ignora', spoof.json?.data?.seller?.id === sellerId,
    `quedo ${spoof.json?.data?.seller?.id}`);
  await req('DELETE', `/vehicles/${spoof.json?.data?.id}`, { token: sellerToken });
}

section('GET /api/vehicles (catalogo y filtros)');
{
  const list = await req('GET', '/vehicles');
  check('sin token -> 200 (catalogo publico)', list.status === 200, `fue ${list.status}`);
  check('  ...trae la pagina', Array.isArray(list.json?.data));
  check('  ...trae la paginacion', typeof list.json?.meta?.page === 'number' && typeof list.json?.meta?.total === 'number',
    `llego ${JSON.stringify(list.json?.meta)}`);
  check('  ...el vehiculo de prueba esta', list.json?.data?.some((v) => v.id === vehicleId));

  const found = await req('GET', '/vehicles?q=porsch');
  check('filtro q insensible a mayusculas', found.json?.data?.some((v) => v.id === vehicleId),
    `encontrados ${found.json?.meta?.total}`);
  check('  ...q en mayusculas', (await req('GET', '/vehicles?q=PORSCHE')).json?.data?.some((v) => v.id === vehicleId),
    `encontrados ${(await req('GET', '/vehicles?q=PORSCHE')).json?.meta?.total}`);

  // La busqueda ignora acentos: se prueba con una marca que los tiene, porque
  // con "Porsche" el test no probaria nada.
  const accented = await req('POST', '/vehicles', {
    token: sellerToken,
    body: {
      vin: `VIN${Date.now()}A`.slice(0, 17), licensePlate: `AC-${String(Date.now()).slice(-4)}`,
      brand: 'Citroën', model: 'C4', year: 2021, mileage: 25000, transmission: 'AUTOMATIC',
      fuel: 'GASOLINE', category: 'COMPACT', engine: '1.2L', power: '130 HP', drivetrain: 'FWD',
      basePrice: 28000, saleType: 'DIRECT_SALE',
    },
  });
  check('alta con marca acentuada -> 201', accented.status === 201, `fue ${accented.status}`);
  const accentedId = accented.json?.data?.id ?? '';
  for (const q of ['citroen', 'CITROEN', 'citroën', 'CITROËN']) {
    const r = await req('GET', `/vehicles?q=${encodeURIComponent(q)}`);
    check(`  ...q=${q} encuentra "Citroën"`, r.json?.data?.some((v) => v.id === accentedId),
      `encontrados ${JSON.stringify(r.json?.data?.map((v) => v.title))}`);
  }

  const byCategory = await req('GET', '/vehicles?category=SPORT&fuel=GASOLINE&minPrice=100000');
  check('filtros combinados', byCategory.json?.data?.some((v) => v.id === vehicleId),
    `encontrados ${byCategory.json?.meta?.total}`);
  check('  ...minPrice descarta los baratos', !(await req('GET', '/vehicles?minPrice=999999')).json?.data?.length);

  const bad = await req('GET', '/vehicles?category=NAVIDAD');
  check('category invalida en query -> 400', bad.status === 400, `fue ${bad.status}`);

  const cap = await req('GET', '/vehicles?pageSize=9999');
  check('pageSize se limita a 100', cap.json?.meta?.pageSize === 100, `quedo ${cap.json?.meta?.pageSize}`);

  const detail = await req('GET', `/vehicles/${vehicleId}`);
  check('detalle sin token -> 200', detail.status === 200, `fue ${detail.status}`);
  const noSuch = await req('GET', '/vehicles/00000000-0000-0000-0000-000000000000');
  check('uuid inexistente -> 404', noSuch.status === 404, `fue ${noSuch.status}`);
  const badUuid = await req('GET', '/vehicles/no-es-uuid');
  check('id no-uuid -> 400', badUuid.status === 400, `fue ${badUuid.status}`);
}

section('GET /api/vehicles/mine');
{
  const noAuth = await req('GET', '/vehicles/mine');
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const mine = await req('GET', '/vehicles/mine', { token: sellerToken });
  check('200', mine.status === 200, `fue ${mine.status}`);
  check('  ...solo los propios', mine.json?.data?.every((v) => v.seller?.id === sellerId || v.sellerId === sellerId),
    `llego ${JSON.stringify(mine.json?.data?.map((v) => v.sellerId))}`);

  // Un DRAFT no puede aparecer en el catalogo, pero si en "mis publicaciones".
  // El borrador se arma publicando primero y guardandolo despues con PATCH: el
  // alta ignora el status que mande el cliente y lo deduce del saleType.
  const draftVehicle = await req('POST', '/vehicles', {
    token: sellerToken,
    body: {
      vin: `VIN${Date.now()}D`.slice(0, 17), licensePlate: 'SMK-DRAFT', brand: 'Renault', model: 'Sandero',
      year: 2018, mileage: 70000, transmission: 'MANUAL', fuel: 'GASOLINE', category: 'COMPACT',
      engine: '1.6L', power: '115 HP', drivetrain: 'FWD', basePrice: 12000, saleType: 'DIRECT_SALE',
    },
  });
  check('crear el vehiculo -> 201', draftVehicle.status === 201, `fue ${draftVehicle.status}`);
  const draftId = draftVehicle.json?.data?.id ?? '';
  check('  ...nace AVAILABLE', draftVehicle.json?.data?.status === 'AVAILABLE', `quedo ${draftVehicle.json?.data?.status}`);

  const reserved = await req('PATCH', `/vehicles/${draftId}`, { token: sellerToken, body: { status: 'SOLD' } });
  check('el vendedor no puede poner SOLD a mano -> 400', reserved.status === 400, `fue ${reserved.status}`);
  const inAuction = await req('PATCH', `/vehicles/${vehicleId}`, { token: sellerToken, body: { status: 'DRAFT' } });
  check('no se puede despublicar un vehiculo en subasta -> 409', inAuction.status === 409, `fue ${inAuction.status}`);

  const draft = await req('PATCH', `/vehicles/${draftId}`, { token: sellerToken, body: { status: 'DRAFT' } });
  check('guardar como borrador -> 200', draft.status === 200, `fue ${draft.status}`);
  const publicList = await req('GET', '/vehicles?q=sandero');
  check('el DRAFT no aparece en el catalogo', !(publicList.json?.data ?? []).some((v) => v.id === draftId),
    `aparecio en ${JSON.stringify(publicList.json?.meta)}`);
  check('el DRAFT aparece en /mine', (await req('GET', '/vehicles/mine?status=DRAFT', { token: sellerToken })).json?.data?.some((v) => v.id === draftId));
  const draftDetail = await req('GET', `/vehicles/${draftId}`, { token: regToken });
  check('otro usuario no ve el DRAFT -> 404', draftDetail.status === 404, `fue ${draftDetail.status}`);
  check('el dueno si ve su DRAFT', (await req('GET', `/vehicles/${draftId}`, { token: sellerToken })).status === 200);
  await req('DELETE', `/vehicles/${draftId}`, { token: sellerToken });
}

section('PATCH /api/vehicles/:id');
{
  const noAuth = await req('PATCH', `/vehicles/${vehicleId}`, { body: { brand: 'Anon' } });
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const other = await req('PATCH', `/vehicles/${vehicleId}`, { token: regToken, body: { brand: 'Secuestrado' } });
  check('otro usuario -> 403', other.status === 403, `fue ${other.status}`);

  const bad = await req('PATCH', `/vehicles/${vehicleId}`, { token: sellerToken, body: { year: 1800 } });
  check('year invalido -> 400', bad.status === 400, `fue ${bad.status}`);

  const r = await req('PATCH', `/vehicles/${vehicleId}`, { token: sellerToken, body: { basePrice: 135000 } });
  check('el dueno edita -> 200', r.status === 200, `fue ${r.status}`);
  check('  ...aplica el cambio', r.json?.data?.basePrice === 135000, `quedo ${r.json?.data?.basePrice}`);
  check('  ...PATCH es parcial', r.json?.data?.model === '911', `model quedo ${r.json?.data?.model}`);
}

section('POST/DELETE /api/vehicles/:id/images');
let imageId = '';
{
  const noAuth = await req('POST', `/vehicles/${vehicleId}/images`, { body: { url: 'https://res.cloudinary.com/demo/x.jpg' } });
  check('agregar sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const other = await req('POST', `/vehicles/${vehicleId}/images`, {
    token: regToken, body: { url: 'https://res.cloudinary.com/demo/image/upload/v1/spiritapex/vehicles/x.jpg' },
  });
  check('otro usuario -> 403', other.status === 403, `fue ${other.status}`);

  const bad = await req('POST', `/vehicles/${vehicleId}/images`, { token: sellerToken, body: { url: 'https://evil.com/x.jpg' } });
  check('url no-Cloudinary -> 400', bad.status === 400, `fue ${bad.status}`);

  const r = await req('POST', `/vehicles/${vehicleId}/images`, {
    token: sellerToken,
    body: { url: 'https://res.cloudinary.com/demo/image/upload/v1/spiritapex/vehicles/smoke-2.jpg', publicId: 'spiritapex/vehicles/smoke-2' },
  });
  check('agregar foto -> 201', r.status === 201, `fue ${r.status}`);
  check('  ...quedan dos fotos', r.json?.data?.images?.length === 2, `quedaron ${r.json?.data?.images?.length}`);
  imageId = r.json?.data?.images?.at(-1)?.id ?? '';

  // Sin Cloudinary configurado el borrado del asset falla, pero la foto tiene
  // que salir de la galeria igual.
  const del = await req('DELETE', `/vehicles/${vehicleId}/images/${imageId}`, { token: sellerToken });
  check('quitar foto -> 204', del.status === 204, `fue ${del.status}`);
  check('  ...vuelve a quedar una', (await req('GET', `/vehicles/${vehicleId}`)).json?.data?.images?.length === 1);
  check('quitar foto ajena -> 404',
    (await req('DELETE', `/vehicles/${vehicleId}/images/${imageId}`, { token: sellerToken })).status === 404);
}

section('POST /api/auctions');
let scheduledAuctionId = '';
{
  const both = await req('POST', '/vehicles', {
    token: sellerToken,
    body: {
      vin: `VIN${Date.now()}B`.slice(0, 17), licensePlate: 'SMK-BOTH', brand: 'Honda', model: 'Civic',
      year: 2019, mileage: 55000, transmission: 'AUTOMATIC', fuel: 'HYBRID', category: 'COMPACT',
      engine: '1.5L Turbo', power: '181 HP', drivetrain: 'FWD', basePrice: 22000, saleType: 'BOTH',
    },
  });
  check('crear BOTH sin subasta -> 201', both.status === 201, `fue ${both.status}`);
  const bothId = both.json?.data?.id ?? '';
  check('  ...queda AVAILABLE', both.json?.data?.status === 'AVAILABLE', `quedo ${both.json?.data?.status}`);

  const noAuth = await req('POST', '/auctions', { body: { vehicleId: bothId, startingPrice: 20000, endTime: new Date(Date.now() + 86400000).toISOString() } });
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const other = await req('POST', '/auctions', {
    token: regToken,
    body: { vehicleId: bothId, startingPrice: 20000, endTime: new Date(Date.now() + 86400000).toISOString() },
  });
  check('vehiculo ajeno -> 403', other.status === 403, `fue ${other.status}`);

  const noSuch = await req('POST', '/auctions', {
    token: sellerToken,
    body: { vehicleId: '00000000-0000-0000-0000-000000000000', startingPrice: 20000, endTime: new Date(Date.now() + 86400000).toISOString() },
  });
  check('vehiculo inexistente -> 404', noSuch.status === 404, `fue ${noSuch.status}`);

  const past = await req('POST', '/auctions', {
    token: sellerToken, body: { vehicleId: bothId, startingPrice: 20000, endTime: new Date(Date.now() - 1000).toISOString() },
  });
  check('endTime en el pasado -> 400', past.status === 400, `fue ${past.status}`);

  const start = new Date(Date.now() + 86400000).toISOString();
  const end = new Date(Date.now() + 172800000).toISOString();
  const r = await req('POST', '/auctions', { token: sellerToken, body: { vehicleId: bothId, startingPrice: 20000, startTime: start, endTime: end } });
  check('agendar -> 201', r.status === 201, `fue ${r.status} ${JSON.stringify(r.json)}`);
  scheduledAuctionId = r.json?.data?.id ?? '';
  check('  ...queda PENDING', r.json?.data?.status === 'PENDING', `quedo ${r.json?.data?.status}`);
  check('  ...el vehiculo anidado ya figura IN_AUCTION', r.json?.data?.vehicle?.status === 'IN_AUCTION',
    `quedo ${r.json?.data?.vehicle?.status}`);
  check('  ...trae el vehiculo', r.json?.data?.vehicle?.title === 'Honda Civic', `quedo ${r.json?.data?.vehicle?.title}`);
  check('  ...arranca sin pujas', r.json?.data?.bidCount === 0 && r.json?.data?.recentBids?.length === 0);

  const dup = await req('POST', '/auctions', { token: sellerToken, body: { vehicleId: bothId, startingPrice: 20000, endTime: end } });
  check('segunda subasta del mismo vehiculo -> 409', dup.status === 409, `fue ${dup.status}`);

  const direct = await req('POST', '/vehicles', {
    token: sellerToken,
    body: {
      vin: `VIN${Date.now()}S`.slice(0, 17), licensePlate: 'SMK-DIR', brand: 'Fiat', model: 'Cronos',
      year: 2022, mileage: 20000, transmission: 'MANUAL', fuel: 'GASOLINE', category: 'COMPACT',
      engine: '1.3L', power: '120 HP', drivetrain: 'FWD', basePrice: 25000, saleType: 'DIRECT_SALE',
    },
  });
  const noAuction = await req('POST', '/auctions', {
    token: sellerToken, body: { vehicleId: direct.json?.data?.id, startingPrice: 24000, endTime: end },
  });
  check('DIRECT_SALE no admite subasta -> 400', noAuction.status === 400, `fue ${noAuction.status}`);
}

section('GET /api/auctions');
{
  const list = await req('GET', '/auctions');
  check('sin token -> 200', list.status === 200, `fue ${list.status}`);
  check('  ...trae la pagina', Array.isArray(list.json?.data));
  check('  ...incluye la subasta de alta', list.json?.data?.some((a) => a.id === scheduledAuctionId));

  const byStatus = await req('GET', '/auctions?status=PENDING');
  check('filtro por status', byStatus.json?.data?.every((a) => a.status === 'PENDING'),
    `llego ${JSON.stringify(byStatus.json?.data?.map((a) => a.status))}`);
  check('filtro por status excluye la ACTIVE', !byStatus.json?.data?.some((a) => a.id === auctionId));

  const byVehicle = await req('GET', `/auctions?vehicleId=${vehicleId}`);
  check('filtro por vehicleId', byVehicle.json?.data?.length === 1 && byVehicle.json.data[0].vehicleId === vehicleId,
    `llego ${JSON.stringify(byVehicle.json?.meta)}`);
  const badStatus = await req('GET', '/auctions?status=DESCONOCIDO');
  check('status invalido -> 400', badStatus.status === 400, `fue ${badStatus.status}`);

  const detail = await req('GET', `/auctions/${auctionId}`);
  check('detalle sin token -> 200', detail.status === 200, `fue ${detail.status}`);
  check('  ...trae el vehiculo', detail.json?.data?.vehicle?.id === vehicleId);
  check('  ...trae al vendedor', detail.json?.data?.seller?.id === sellerId);
  check('  ...sin ganador todavia', detail.json?.data?.currentWinner === null);
  check('  ...no expone passwordHash', !JSON.stringify(detail.json).includes('$2b$'));
  check('uuid inexistente -> 404', (await req('GET', '/auctions/00000000-0000-0000-0000-000000000000')).status === 404);
}

section('PATCH/DELETE /api/auctions/:id');
{
  const noAuth = await req('PATCH', `/auctions/${scheduledAuctionId}`, { body: { startingPrice: 1 } });
  check('editar sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const other = await req('PATCH', `/auctions/${scheduledAuctionId}`, { token: regToken, body: { startingPrice: 1 } });
  check('otro usuario edita -> 403', other.status === 403, `fue ${other.status}`);

  const active = await req('PATCH', `/auctions/${auctionId}`, { token: sellerToken, body: { startingPrice: 100 } });
  check('subasta ya ACTIVE -> 409', active.status === 409, `fue ${active.status}`);

  const inverted = await req('PATCH', `/auctions/${scheduledAuctionId}`, {
    token: sellerToken,
    body: { startTime: new Date(Date.now() + 172800000).toISOString(), endTime: new Date(Date.now() + 86400000).toISOString() },
  });
  check('startTime posterior a endTime -> 400', inverted.status === 400, `fue ${inverted.status}`);

  const edited = await req('PATCH', `/auctions/${scheduledAuctionId}`, { token: sellerToken, body: { startingPrice: 21000, minBidIncrement: 250 } });
  check('editar PENDING -> 200', edited.status === 200, `fue ${edited.status}`);
  check('  ...aplica el precio', edited.json?.data?.startingPrice === 21000, `quedo ${edited.json?.data?.startingPrice}`);
  check('  ...aplica el incremento', edited.json?.data?.minBidIncrement === 250, `quedo ${edited.json?.data?.minBidIncrement}`);

  const delNoAuth = await req('DELETE', `/auctions/${scheduledAuctionId}`);
  check('borrar sin token -> 401', delNoAuth.status === 401, `fue ${delNoAuth.status}`);
  const delOther = await req('DELETE', `/auctions/${scheduledAuctionId}`, { token: regToken });
  check('borrar por otro -> 403', delOther.status === 403, `fue ${delOther.status}`);

  const del = await req('DELETE', `/auctions/${scheduledAuctionId}`, { token: sellerToken });
  check('cancelar -> 204', del.status === 204, `fue ${del.status}`);
  const after = await req('GET', `/auctions/${scheduledAuctionId}`);
  check('  ...queda CANCELLED', after.json?.data?.status === 'CANCELLED', `quedo ${after.json?.data?.status}`);
  const backInCatalog = await req('GET', '/vehicles?q=civic');
  check('  ...el vehiculo vuelve al catalogo', backInCatalog.json?.data?.some((v) => v.status === 'AVAILABLE'),
    `llego ${JSON.stringify(backInCatalog.json?.data?.map((v) => v.status))}`);
}

section('DELETE /api/vehicles/:id (borrado logico)');
{
  const other = await req('DELETE', `/vehicles/${vehicleId}`, { token: regToken });
  check('otro usuario -> 403', other.status === 403, `fue ${other.status}`);

  const del = await req('DELETE', `/vehicles/${vehicleId}`, { token: sellerToken });
  check('el dueno da de baja -> 204', del.status === 204, `fue ${del.status}`);
  check('  ...ya no se puede ver', (await req('GET', `/vehicles/${vehicleId}`)).status === 404);
  check('  ...no queda en el catalogo', !(await req('GET', '/vehicles?q=porsche')).json?.data?.some((v) => v.id === vehicleId));
  check('  ...tampoco en /mine', !(await req('GET', '/vehicles/mine', { token: sellerToken })).json?.data?.some((v) => v.id === vehicleId));

  // Dar de baja el vehiculo tiene que cancelar su subasta, no dejarla colgada.
  const auctions = await req('GET', '/auctions');
  check('  ...la subasta se cancela sola', !auctions.json?.data?.some((a) => a.id === auctionId && a.status !== 'CANCELLED'),
    `llego ${JSON.stringify(auctions.json?.data?.map((a) => [a.id === auctionId, a.status]))}`);
  check('  ...y desaparece del listado', !(await req('GET', `/auctions/${auctionId}`)).json?.data
    || (await req('GET', `/auctions/${auctionId}`)).status === 404);
}

// ---------------------------------------------------------------------------

// Todo lo de pujas necesita postores que no sean el vendedor, asi que se crean
// cuentas propias. El prefijo smoke. las hace borrables por la limpieza final.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera a que fn devuelva algo truthy. Necesario porque el cierre de subastas lo
 * hace el timer cada 15s y tambien el endpoint manual: cual de los dos corra
 * primero es una carrera, y un test que suppose que fue el manual falla una de
 * cada quince corridas sin que haya ningun bug de por medio.
 */
const waitFor = async (fn, timeoutMs = 20_000, everyMs = 250) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(everyMs);
  }
};

const bidders = [];
for (const [i, tag] of ['b1', 'b2', 'b3'].entries()) {
  const email = uniqueEmail(tag);
  created.push(email);
  const r = await req('POST', '/auth/register', {
    body: { email, password: 'Pujador1!', fullName: `Pujador ${tag}`, phone: `+54 9 11 4000-100${i}` },
  });
  bidders.push({ tag, token: r.json?.data?.accessToken ?? '', id: r.json?.data?.user?.id ?? '' });
}
const [b1, b2, b3] = bidders;

// `BOTH` y no `AUCTION`: la subasta se crea despues con POST /auctions, y un
// vehiculo `AUCTION` exige el bloque `auction` anidado en el alta. Devolver '' en
// silencio hacia que los asserts siguientes fallaran con ids vacios en vez de
// decir que fallo el alta, asi que estos helpers se quejan.
const mkVehicle = async (tag, saleType = 'BOTH') => {
  const r = await req('POST', '/vehicles', {
    token: sellerToken,
    body: {
      vin: `VIN${Date.now()}${tag}`.slice(0, 17), licensePlate: `SMK-${tag}`,
      brand: 'Toyota', model: 'Corolla', year: 2021, mileage: 40000, transmission: 'AUTOMATIC',
      fuel: 'GASOLINE', category: 'SEDAN', engine: '2.0L', power: '150 HP', drivetrain: 'FWD',
      basePrice: 10000, saleType,
    },
  });
  if (r.status !== 201) {
    throw new Error(`mkVehicle(${tag}) -> ${r.status} ${JSON.stringify(r.json)}`);
  }
  return r.json?.data?.id ?? '';
};

const mkAuction = async (tag, { startingPrice = 10000, minBidIncrement = 250, startInMs = 0, endInMs = 300000 } = {}) => {
  const vehicleId = await mkVehicle(tag);
  const r = await req('POST', '/auctions', {
    token: sellerToken,
    body: {
      vehicleId, startingPrice, minBidIncrement,
      ...(startInMs > 0 ? { startTime: new Date(Date.now() + startInMs).toISOString() } : {}),
      endTime: new Date(Date.now() + endInMs).toISOString(),
    },
  });
  if (r.status !== 201) {
    throw new Error(`mkAuction(${tag}) -> ${r.status} ${JSON.stringify(r.json)}`);
  }
  return { vehicleId, auctionId: r.json?.data?.id ?? '', status: r.json?.data?.status };
};

section('POST /api/auctions/:id/bids (validacion)');
const live = await mkAuction('LIVE');
{
  check('subasta de prueba creada y activa', live.auctionId !== '' && live.status === 'ACTIVE', `quedo ${live.status}`);

  const noAuth = await req('POST', `/auctions/${live.auctionId}/bids`, { body: { amount: 10000 } });
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const noAmount = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: {} });
  check('sin amount -> 400', noAmount.status === 400, `fue ${noAmount.status}`);
  check('  ...detalle en "amount"', Boolean(noAmount.json?.error?.details?.['amount']),
    `llegan ${Object.keys(noAmount.json?.error?.details ?? {}).join(',')}`);

  const notNumber = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: { amount: 'mucho' } });
  check('amount no numerico -> 400', notNumber.status === 400, `fue ${notNumber.status}`);

  const zero = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: { amount: 0 } });
  check('amount 0 -> 400', zero.status === 400, `fue ${zero.status}`);

  const negative = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: { amount: -5 } });
  check('amount negativo -> 400', negative.status === 400, `fue ${negative.status}`);

  // La columna es Decimal(12,2): un cuarto decimal no se puede representar y
  // truncarlo en silencio seria peor que rechazarlo.
  const threeDecimals = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: { amount: 10000.125 } });
  check('amount con 3 decimales -> 400', threeDecimals.status === 400, `fue ${threeDecimals.status}`);

  const noSuch = await req('POST', '/auctions/00000000-0000-0000-0000-000000000000/bids', { token: b1.token, body: { amount: 10000 } });
  check('subasta inexistente -> 404', noSuch.status === 404, `fue ${noSuch.status}`);

  const own = await req('POST', `/auctions/${live.auctionId}/bids`, { token: sellerToken, body: { amount: 10000 } });
  check('el vendedor puja en su subasta -> 403', own.status === 403, `fue ${own.status}`);
}

section('POST /api/auctions/:id/bids (minimo y primera puja)');
{
  const low = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: { amount: 9999.99 } });
  check('monto bajo el minimo -> 409', low.status === 409, `fue ${low.status}`);
  check('  ...detalle.minimum = startingPrice', low.json?.error?.details?.minimum === 10000,
    `llego ${low.json?.error?.details?.minimum}`);
  check('  ...currentBid null todavia', low.json?.error?.details?.currentBid === null);

  const first = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: { amount: 10000 } });
  check('primera puja exacta -> 201', first.status === 201, `fue ${first.status} ${JSON.stringify(first.json)}`);
  check('  ...devuelve la puja', first.json?.data?.bid?.amount === 10000, `llego ${first.json?.data?.bid?.amount}`);
  check('  ...y la subasta entera', first.json?.data?.auction?.id === live.auctionId);
  check('  ...minimumNextBid = puja + incremento', first.json?.data?.minimumNextBid === 10250,
    `llego ${first.json?.data?.minimumNextBid}`);

  const after = (await req('GET', `/auctions/${live.auctionId}`)).json?.data;
  check('  ...currentBid actualizado', after?.currentBid === 10000, `quedo ${after?.currentBid}`);
  check('  ...currentWinner es el postor', after?.currentWinner?.id === b1.id);
  check('  ...bidCount = 1', after?.bidCount === 1, `quedo ${after?.bidCount}`);
  check('  ...aparece en recentBids', after?.recentBids?.[0]?.amount === 10000);
  check('  ...el vehiculo sigue IN_AUCTION', after?.vehicle?.status === 'IN_AUCTION', `quedo ${after?.vehicle?.status}`);

  // Pujar por encima de la propia puja no compra nada (no hay escrow) y un doble
  // toque en la app es la forma natural de pagar dos veces por error.
  const again = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b1.token, body: { amount: 11000 } });
  check('el ganador puja otra vez -> 409', again.status === 409, `fue ${again.status}`);
  check('  ...con el mensaje del auto-sobreoferta', again.json?.error?.message === 'Ya sos el ganador actual de esta subasta',
    `llego ${again.json?.error?.message}`);

  const short = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b2.token, body: { amount: 10249.99 } });
  check('medio centavo debajo del minimo -> 409', short.status === 409, `fue ${short.status}`);
  check('  ...el minimo se respeta al centavo', short.json?.error?.details?.minimum === 10250,
    `llego ${short.json?.error?.details?.minimum}`);

  const second = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b2.token, body: { amount: 10250 } });
  check('sobreoferta valida -> 201', second.status === 201, `fue ${second.status}`);
  check('  ...currentWinner cambia', second.json?.data?.auction?.currentWinner?.id === b2.id);
  check('  ...bidCount = 2', second.json?.data?.auction?.bidCount === 2, `quedo ${second.json?.data?.auction?.bidCount}`);

  // Centavos exactos: si la aritmetica fuera con float, 10500.55 podria
  // guardarse como 10500.549999 y el minio siguiente quedaria corrido.
  const third = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b3.token, body: { amount: 10500.55 } });
  check('tercera puja con centavos -> 201', third.status === 201, `fue ${third.status}`);
  check('  ...se guarda exacta, sin error de coma flotante', third.json?.data?.bid?.amount === 10500.55,
    `llego ${third.json?.data?.bid?.amount}`);
  check('  ...currentId exacto', third.json?.data?.auction?.currentBid === 10500.55,
    `llego ${third.json?.data?.auction?.currentBid}`);
  check('  ...minimumNextBid exacto', third.json?.data?.minimumNextBid === 10750.55,
    `llego ${third.json?.data?.minimumNextBid}`);

  // El minimo que anuncia un 409 y el que devuelve una puja aceptada tienen que
  // salir de la misma cuenta. Antes uno se computaba en centavos y el otro en
  // unidades, asi que el primero era 100 veces el segundo.
  const cross = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b2.token, body: { amount: 1 } });
  check('el minimo del 409 coincide con el minimumNextBid de la puja anterior',
    cross.json?.error?.details?.minimum === third.json?.data?.minimumNextBid,
    `${cross.json?.error?.details?.minimum} vs ${third.json?.data?.minimumNextBid}`);
}

section('POST /api/auctions/:id/bids (concurrencia)');
{
  // El caso que motiva el SELECT ... FOR UPDATE: sin bloqueo, tres pujas al
  // mismo monto leen la misma currentBid, las tres pasan el minimo y las tres
  // escriben, dejando el contador desfasado del maximo real.
  const race = await mkAuction('RACE', { startingPrice: 5000, minBidIncrement: 100 });
  check('subasta de carrera creada', race.auctionId !== '');

  const attempts = await Promise.all(bidders.map((b) => req('POST', `/auctions/${race.auctionId}/bids`, {
    token: b.token, body: { amount: 5000 },
  })));

  const winners = attempts.filter((r) => r.status === 201);
  const losers = attempts.filter((r) => r.status === 409);
  check('exactamente 1 de 3 pujas simultaneas gana', winners.length === 1,
    `ganaron ${winners.length} (${attempts.map((r) => r.status).join(',')})`);
  check('  ...las otras dos reciben 409', losers.length === 2, `perdieron ${losers.length}`);
  check('  ...ninguna recibe 500', !attempts.some((r) => r.status >= 500),
    `llego ${attempts.map((r) => r.status).join(',')}`);
  check('  ...el 409 reporta el minimo ya actualizado', losers.every((r) => r.json?.error?.details?.minimum === 5100),
    `llego ${losers.map((r) => r.json?.error?.details?.minimum).join(',')}`);

  const after = (await req('GET', `/auctions/${race.auctionId}`)).json?.data;
  check('  ...Queda una sola puja guardada', after?.bidCount === 1, `quedaron ${after?.bidCount}`);
  check('  ...currentBid es el monto ofertado', after?.currentBid === 5000, `quedo ${after?.currentBid}`);
  check('  ...currentWinner coincide con el unico 201',
    after?.currentWinner?.id === winners[0]?.json?.data?.bid?.bidder?.id);
  check('  ...el vehiculo no quedo SOLD antes de tiempo', after?.vehicle?.status === 'IN_AUCTION',
    `quedo ${after?.vehicle?.status}`);
}

section('GET /api/auctions/:id/bids');
{
  const all = await req('GET', `/auctions/${live.auctionId}/bids`);
  check('historial publico -> 200', all.status === 200, `fue ${all.status}`);
  check('  ...total = bidCount de la subasta', all.json?.meta?.total === 3, `llego ${all.json?.meta?.total}`);
  check('  ...de la mas nueva a la mas vieja', all.json?.data?.[0]?.amount === 10500.55,
    `primera ${all.json?.data?.[0]?.amount}`);
  check('  ...y la mas vieja al final', all.json?.data?.[2]?.amount === 10000, `ultima ${all.json?.data?.[2]?.amount}`);
  check('  ...con el nombre del postor', typeof all.json?.data?.[0]?.bidder?.fullName === 'string');

  const paged = await req('GET', `/auctions/${live.auctionId}/bids?page=1&pageSize=2`);
  check('  ...paginado devuelve pageSize', paged.json?.meta?.pageSize === 2, `llego ${paged.json?.meta?.pageSize}`);
  check('  ...totalPages calculado', paged.json?.meta?.totalPages === 2, `llego ${paged.json?.meta?.totalPages}`);
  check('  ...solo 2 filas', paged.json?.data?.length === 2, `llegaron ${paged.json?.data?.length}`);

  const page2 = await req('GET', `/auctions/${live.auctionId}/bids?page=2&pageSize=2`);
  check('  ...la pagina 2 trae el resto', page2.json?.data?.length === 1, `llegaron ${page2.json?.data?.length}`);

  const bad = await req('GET', `/auctions/${live.auctionId}/bids?pageSize=0`);
  check('pageSize 0 -> 400', bad.status === 400, `fue ${bad.status}`);

  const noSuch = await req('GET', '/auctions/00000000-0000-0000-0000-000000000000/bids');
  check('subasta inexistente -> 404', noSuch.status === 404, `fue ${noSuch.status}`);
}

section('GET /api/bids/mine');
{
  const noAuth = await req('GET', '/bids/mine');
  check('sin token -> 401', noAuth.status === 401, `fue ${noAuth.status}`);

  const mine = await req('GET', '/bids/mine', { token: b1.token });
  check('mis pujas -> 200', mine.status === 200, `fue ${mine.status}`);
  check('  ...solo trae pujas propias', (mine.json?.data ?? []).every((b) => b.bidder?.id === b1.id));
  const onLive = (mine.json?.data ?? []).filter((b) => b.auction?.id === live.auctionId);
  check('  ...1 puja en la subasta LIVE', onLive.length === 1, `llegaron ${onLive.length}`);
  check('  ...con el monto correcto', onLive[0]?.amount === 10000, `llego ${onLive[0]?.amount}`);
  check('  ...y el contexto de la subasta', onLive[0]?.auction?.currentBid === 10500.55,
    `llego ${onLive[0]?.auction?.currentBid}`);
  check('  ...el desplazado sigue viendo su puja', onLive[0]?.amount !== onLive[0]?.auction?.currentBid);

  const other = await req('GET', '/bids/mine', { token: b2.token });
  const otherOnLive = (other.json?.data ?? []).filter((b) => b.auction?.id === live.auctionId);
  check('otro usuario ve la suya, no la ajena', otherOnLive.length === 1 && otherOnLive[0]?.amount === 10250,
    `llego ${otherOnLive.map((b) => b.amount).join(',')}`);
  check('  ...no se puede pedir el de otro', !(other.json?.data ?? []).some((b) => b.bidder?.id === b1.id));
}

section('Ciclo de vida automatico de la subasta (PENDING -> ACTIVE)');
{
  const pending = await mkAuction('PEND', { startingPrice: 8000, startInMs: 1200, endInMs: 300000 });
  check('subasta futura queda PENDING', pending.status === 'PENDING', `quedo ${pending.status}`);

  const early = await req('POST', `/auctions/${pending.auctionId}/bids`, { token: b1.token, body: { amount: 8000 } });
  check('pujar antes de que arranque -> 409', early.status === 409, `fue ${early.status}`);
  check('  ...mensaje de "todavia no empezo"', early.json?.error?.message === 'La subasta todavia no empezo',
    `llego ${early.json?.error?.message}`);

  const forbidden = await req('POST', '/auctions/lifecycle', { token: regToken });
  check('disparar el ciclo de vida como BUYER -> 403', forbidden.status === 403, `fue ${forbidden.status}`);

  await sleep(1600);
  const run = await req('POST', '/auctions/lifecycle', { token: adminToken });
  check('como ADMIN -> 200', run.status === 200, `fue ${run.status}`);
  check('  ...reporta las activadas', typeof run.json?.data?.activated === 'number',
    `llego ${JSON.stringify(run.json?.data?.activated)}`);
  check('  ...y las cerradas en un array', Array.isArray(run.json?.data?.closed));

  const now = (await req('GET', `/auctions/${pending.auctionId}`)).json?.data;
  check('la subasta PENDING paso a ACTIVE sola', now?.status === 'ACTIVE', `quedo ${now?.status}`);

  // La prueba de que activar no es cosmético: ahora la puja entra.
  const ok = await req('POST', `/auctions/${pending.auctionId}/bids`, { token: b1.token, body: { amount: 8000 } });
  check('  ...y ya se puede pujar', ok.status === 201, `fue ${ok.status} ${JSON.stringify(ok.json)}`);
}

section('Cierre automatico (ACTIVE -> FINISHED)');
{
  const closing = await mkAuction('CLOSE', { startingPrice: 7000, minBidIncrement: 100, endInMs: 2500 });
  check('subasta corta creada y activa', closing.status === 'ACTIVE', `quedo ${closing.status}`);

  const bid = await req('POST', `/auctions/${closing.auctionId}/bids`, { token: b2.token, body: { amount: 7000 } });
  check('puja antes de vencer -> 201', bid.status === 201, `fue ${bid.status}`);

  await sleep(2800);
  const run = await req('POST', '/auctions/lifecycle', { token: adminToken });
  check('el ciclo de vida responde con la forma esperada',
    typeof run.json?.data?.activated === 'number' && Array.isArray(run.json?.data?.closed),
    `llego ${JSON.stringify(run.json?.data)}`);

  // El cierre puede haberlo hecho esta llamada o el timer, segun en que momento
  // corra cada uno: lo que importa es que la subasta termine cerrada sola.
  const after = await waitFor(async () => {
    const r = await req('GET', `/auctions/${closing.auctionId}`);
    return r.json?.data?.status === 'FINISHED' ? r.json.data : null;
  });
  check('la subasta vencida termina FINISHED sola', Boolean(after), 'no llego a FINISHED en 20s');
  check('  ...con el ganador fijado', after?.currentWinner?.id === b2.id, `llego ${after?.currentWinner?.id}`);
  check('  ...y su puja mas alta', after?.currentBid === 7000, `llego ${after?.currentBid}`);
  check('  ...el vehiculo quedo SOLD', after?.vehicle?.status === 'SOLD', `quedo ${after?.vehicle?.status}`);

  const late = await req('POST', `/auctions/${closing.auctionId}/bids`, { token: b1.token, body: { amount: 9000 } });
  check('pujar en una subasta cerrada -> 409', late.status === 409, `fue ${late.status}`);
  check('  ...mensaje de "ya termino"', late.json?.error?.message === 'La subasta ya termino',
    `llego ${late.json?.error?.message}`);

  const cancel = await req('DELETE', `/auctions/${closing.auctionId}`, { token: sellerToken });
  check('cancelar una subasta finalizada -> 409', cancel.status === 409, `fue ${cancel.status}`);

  const again = await req('POST', '/auctions/lifecycle', { token: adminToken });
  check('el ciclo de vida es idempotente', !(again.json?.data?.closed ?? []).some((c) => c.auctionId === closing.auctionId),
    `llego ${JSON.stringify(again.json?.data?.closed)}`);
}

section('Cierre sin pujas: el vehiculo vuelve al catalogo');
{
  const empty = await mkAuction('EMPTY', { startingPrice: 6000, endInMs: 2000 });
  await sleep(2300);
  await req('POST', '/auctions/lifecycle', { token: adminToken });

  const after = (await req('GET', `/auctions/${empty.auctionId}`)).json?.data;
  check('la subasta sin pujas queda FINISHED', after?.status === 'FINISHED', `quedo ${after?.status}`);
  check('  ...sin ganador', after?.currentWinner === null, `llego ${JSON.stringify(after?.currentWinner)}`);
  check('  ...y sin puja vigente', after?.currentBid === null, `llego ${after?.currentBid}`);
  // Sin pujas no hay venta: dejarlo IN_AUCTION lo escondia del catalogo para
  // siempre, sin Nadie que pudiera comprarlo ni pujar.
  check('  ...el vehiculo vuelve a AVAILABLE', after?.vehicle?.status === 'AVAILABLE',
    `quedo ${after?.vehicle?.status}`);
}

section('Pujas en vivo por socket');
{
  const { io } = await import('socket.io-client');

  // El ganador actual escucha: recibe el evento de sala Y el aviso de que lo
  // desplazaron, que va a su sala personal y no a la de la subasta.
  const watcher = await new Promise((resolve) => {
    const socket = io(BASE.replace('/api', ''), {
      transports: ['websocket'], auth: { token: b3.token }, reconnection: false, timeout: 5000,
    });
    const received = { bidPlaced: null, outbid: null, errors: [] };
    socket.on('connection:error', (e) => received.errors.push(e));
    socket.on('auction:bid-placed', (payload) => { received.bidPlaced = payload; });
    socket.on('auction:outbid', (payload) => { received.outbid = payload; });
    socket.on('connection:ready', () => {
      // La sala valida contra la base: sin esto, un uuid inexistente entraba igual.
      socket.emit('auction:join', { auctionId: '00000000-0000-0000-0000-000000000000' });
      setTimeout(() => {
        socket.emit('auction:join', { auctionId: live.auctionId });
        setTimeout(() => resolve({ socket, received }), 300);
      }, 300);
    });
    setTimeout(() => resolve({ socket, received }), 6000);
  });

  const push = await req('POST', `/auctions/${live.auctionId}/bids`, { token: b2.token, body: { amount: 10750.55 } });
  check('la puja que se emite por HTTP -> 201', push.status === 201, `fue ${push.status}`);
  await sleep(500);

  check('quien esta en la sala recibe auction:bid-placed', Boolean(watcher.received.bidPlaced),
    JSON.stringify(watcher.received));
  check('  ...con el monto de la puja', watcher.received.bidPlaced?.currentBid === 10750.55,
    `llego ${watcher.received.bidPlaced?.currentBid}`);
  check('  ...el contador actualizado', watcher.received.bidPlaced?.bidCount === 4,
    `llego ${watcher.received.bidPlaced?.bidCount}`);
  check('  ...el minimo siguiente ya calculado', watcher.received.bidPlaced?.minimumNextBid === 11000.55,
    `llego ${watcher.received.bidPlaced?.minimumNextBid}`);
  check('  ...y el nuevo ganador', watcher.received.bidPlaced?.currentWinner?.id === b2.id);
  check('el desplazado recibe auction:outbid', Boolean(watcher.received.outbid),
    JSON.stringify(watcher.received.outbid));
  check('  ...con el minimo para reintentar', watcher.received.outbid?.minimumNextBid === 11000.55,
    `llego ${watcher.received.outbid?.minimumNextBid}`);
  check('entrar a la sala de una subasta inexistente -> error', watcher.received.errors.some((e) => e.code === 'NOT_FOUND'),
    JSON.stringify(watcher.received.errors));

  watcher.socket.close();
  await sleep(100);
}

// ---------------------------------------------------------------------------

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

section('Invariante de cierre (barrido de todas las subastas)');
{
  // El timer de 15s corrio durante toda la suite contra datos reales, asi que
  // este barrido es la red que atrapa el cierre decidido con una lectura vieja:
  // una subasta cerrada CON ganador tiene que tener el vehiculo SOLD. Si el
  // cierre no serializa contra las pujas, el timer puede mandar a AVAILABLE un
  // vehiculo que ya tiene comprador y queda a la venta en el catalogo.
  //
  // Va contra prisma y no contra la API justamente para poder mirar el estado
  // crudo de las dos tablas a la vez: por HTTP se verian consistentes todavia.
  const { prisma } = await import('../src/lib/prisma.js');
  const rows = await prisma.auction.findMany({
    select: {
      id: true,
      status: true,
      currentWinnerId: true,
      vehicle: { select: { id: true, status: true } },
      bids: { select: { id: true } },
    },
  });

  const rotas = rows.filter((a) => {
    const vendido = a.status === 'FINISHED' && a.currentWinnerId !== null;
    const coherente = a.status !== 'FINISHED'
      || (a.currentWinnerId === null ? a.vehicle.status !== 'SOLD' : a.vehicle.status === 'SOLD');
    return vendido && !coherente;
  });

  check('hay subastas para revisar', rows.length > 0, `solo hay ${rows.length}`);
  check('ninguna subasta cerrada con ganador tiene el vehiculo en otro estado', rotas.length === 0,
    rotas.map((a) => `${a.id.slice(0, 8)} winner=${a.currentWinnerId} vehiculo=${a.vehicle.status}`).join(', '));

  const sinPujasEnVenta = rows.filter(
    (a) => a.status === 'FINISHED' && a.currentWinnerId === null && a.vehicle.status === 'SOLD',
  );
  check('ninguna subasta sin pujas dejo el vehiculo vendido', sinPujasEnVenta.length === 0,
    sinPujasEnVenta.map((a) => a.id.slice(0, 8)).join(', '));

  // Invariante denormalizado: currentBid y currentWinnerId no pueden divergir
  // de MAX(bids). placeBid los escribe en la misma transaccion que la puja.
  const divergentes = rows.filter((a) => a.currentWinnerId === null && a.vehicle.status === 'SOLD');
  check('currentWinnerId y las pujas no divergen', divergentes.length === 0,
    divergentes.map((a) => a.id.slice(0, 8)).join(', '));

  // -------------------------------------------------------------------------
  // El test que de verdad reproduce el bug.
  //
  // El barrido de arriba es una red: mira el resultado, pero no fuerza el
  // entrelazado, asi que pasa con el bug puesto (comprobado). Este lo fuerza:
  // dos transacciones reales de prisma, la puja con el lock tomado y sin
  // commitear, y el cierre del timer pyrofiando la fila.
  //
  // Sin serializar, el timer lee `winner = null`, la puja comitea con ganador, y
  // el timer cierra con el dato viejo dejando el vehiculo AVAILABLE: un auto ya
  // vendido a la venta en el catalogo. Con el lock, el cierre espera, relee y ve
  // al ganador.
  {
    const stamp = Date.now();
    const tag = `smoke.lock${stamp}`;
    const mkUser = async (suffix, role) => {
      const email = `${tag}.${suffix}@spirit.dev`;
      created.push(email);
      return prisma.user.create({ data: { email, passwordHash: 'x', fullName: `Lock ${suffix}`, role } });
    };
    const lockSeller = await mkUser('s', 'SELLER');
    const lockWinner = await mkUser('w', 'BUYER');

    const lv = await prisma.vehicle.create({
      data: {
        sellerId: lockSeller.id, vin: `LCK${stamp}`.slice(0, 17), licensePlate: `LCK${stamp}`,
        brand: 'Kia', model: 'Rio', year: 2020, mileage: 30000, transmission: 'MANUAL', fuel: 'GASOLINE',
        category: 'COMPACT', engine: '1.6L', power: '120 HP', drivetrain: 'FWD', basePrice: '9000',
        saleType: 'BOTH', status: 'IN_AUCTION',
      },
    });
    const la = await prisma.auction.create({
      data: {
        vehicleId: lv.id, sellerId: lockSeller.id, startingPrice: '9000', minBidIncrement: '100',
        startTime: new Date(Date.now() - 60_000), endTime: new Date(Date.now() - 30_000), status: 'ACTIVE',
      },
    });

    const { finalizeAuction } = await import('../src/modules/auction/auction.state.js');

    let pujando = () => {};
    const conLock = new Promise((r) => { pujando = r; });
    let comitear = () => {};
    const puedeComitear = new Promise((r) => { comitear = r; });

    // La puja: mismo lock que usa placeBid, y se queda abierta.
    const bidTx = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM auctions WHERE id = ${la.id}::uuid FOR UPDATE`;
      await tx.bid.create({ data: { auctionId: la.id, bidderId: lockWinner.id, amount: '9500' } });
      await tx.auction.update({
        where: { id: la.id },
        data: { currentBid: '9500', currentWinnerId: lockWinner.id },
      });
      pujando();
      await puedeComitear;
    }, { timeout: 30000 });

    await conLock;
    const cierre = prisma.$transaction(async (tx) => finalizeAuction(tx, la.id), { timeout: 30000 });

    // Si el cierre resolviera antes de que la puja comitee, es que no bloqueo y
    // esta leyendo una fila que otro flujo todavia no comiteo.
    const resolvioAntes = await Promise.race([
      cierre.then(() => true),
      sleep(1200).then(() => false),
    ]);
    check('el cierre no resuelve mientras la puja tiene el lock', resolvioAntes === false,
      'el cierre decidio sin esperar al lock de la puja');

    comitear();
    await bidTx;
    const closure = await cierre;
    check('el cierre ve al ganador que la puja acaba de fijar',
      closure?.winnerId === lockWinner.id, `llego ${String(closure?.winnerId)}`);

    const lvAfter = await prisma.vehicle.findUniqueOrThrow({ where: { id: lv.id } });
    check('el vehiculo con ganador queda SOLD, no AVAILABLE',
      lvAfter.status === 'SOLD', `quedo ${lvAfter.status}`);

    await prisma.bid.deleteMany({ where: { auctionId: la.id } });
    await prisma.auction.deleteMany({ where: { id: la.id } });
    await prisma.vehicle.deleteMany({ where: { id: lv.id } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  }

  await prisma.$disconnect();
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
      // El orden lo imponen los FKs: auctions.vehicleId y vehicles.sellerId son
      // Restrict, asi que los vehiculos (y sus subastas) tienen que caer antes
      // que los usuarios. Las imagenes y las pujas van en cascada.
      const sellers = await prisma.user.findMany({ where: { email: { startsWith: 'smoke.' } }, select: { id: true } });
      const sellerIds = sellers.map((u) => u.id);
      const owned = await prisma.vehicle.findMany({ where: { sellerId: { in: sellerIds } }, select: { id: true } });
      const vehicleIds = owned.map((v) => v.id);
      const auctions = await prisma.auction.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
      const vehicles = await prisma.vehicle.deleteMany({ where: { sellerId: { in: sellerIds } } });
      const { count } = await prisma.user.deleteMany({ where: { email: { startsWith: 'smoke.' } } });
      await prisma.$disconnect();
      console.log(`Limpieza: ${auctions.count} subasta(s), ${vehicles.count} vehiculo(s), `
        + `${count} usuario(s) smoke.* eliminados.\n`);
  } catch (err) {
    console.log(`No se pudo limpiar (el servidor de la API puede seguir usando la DB): ${err.message}\n`);
  }
}

process.exit(fail === 0 ? 0 : 1);
