// Seed de operaciones con auto-reporte por email (Resend). Generado, no editar a mano.
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// seed-final.ts
var import_client = require("@prisma/client");
var bcrypt = __toESM(require("bcryptjs"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var prisma = new import_client.PrismaClient();
var fecha = (v) => v ? new Date(v) : null;
var norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
async function runSeed() {
  const _log = [];
  const cap = (m) => {
    _log.push(m);
    console.log("###SEED### " + m);
  };
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password) {
    throw new Error(
      'Falta SEED_DEFAULT_PASSWORD. Definila antes de correr el seed, por ejemplo:\n  SEED_DEFAULT_PASSWORD="unaClaveTemporal" pnpm ... seed-operaciones.ts'
    );
  }
  const orgSlug = process.env.ORGANIZATION_SLUG ?? "acme-corp";
  const org = await prisma.organization.findFirst({ where: { slug: orgSlug } });
  if (!org) throw new Error(`No existe la organizaci\xF3n con slug "${orgSlug}"`);
  const raw = fs.readFileSync(path.join(__dirname, "../../../packages/database/prisma/datos-iniciales.json"), "utf8");
  const { usuarios, clientes } = JSON.parse(raw);
  const hash2 = await bcrypt.hash(password, 12);
  const usuariosCreados = [];
  for (const u of usuarios) {
    const existente = await prisma.user.findUnique({ where: { email: u.email } });
    if (existente) {
      const actualizado = await prisma.user.update({
        where: { id: existente.id },
        data: { name: u.name, phone: u.phone, role: u.role }
      });
      usuariosCreados.push(actualizado);
      console.log(`  = ${u.email} ya exist\xEDa, se actualiz\xF3 nombre/rol`);
    } else {
      const creado = await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hash2,
          phone: u.phone,
          role: u.role,
          organizationId: org.id
        }
      });
      usuariosCreados.push(creado);
      console.log(`  + ${u.email} creado como ${u.role}`);
    }
  }
  const porApellido = /* @__PURE__ */ new Map();
  for (const u of usuariosCreados) {
    for (const parte of norm(u.name).split(/\s+/)) {
      if (parte.length > 2 && !porApellido.has(parte)) porApellido.set(parte, u.id);
    }
  }
  const resolverEjecutivo = (nombre) => {
    if (!nombre) return null;
    for (const parte of norm(nombre).split(/\s+/)) {
      const id = porApellido.get(parte);
      if (id) return id;
    }
    return null;
  };
  let nuevos = 0;
  let yaExistian = 0;
  const sinEjecutivo = [];
  for (const c of clientes) {
    const ejecutivoId = resolverEjecutivo(c.ejecutivoNombre);
    if (c.ejecutivoNombre && !ejecutivoId) {
      sinEjecutivo.push(`${c.nombres} ${c.apellidos} (${c.ejecutivoNombre})`);
    }
    const existente = await prisma.cliente.findUnique({
      where: {
        organizationId_identificacion: {
          organizationId: org.id,
          identificacion: c.identificacion
        }
      }
    });
    if (existente) {
      yaExistian++;
      console.log(`  = cliente ${c.identificacion} ya exist\xEDa, se omite`);
      continue;
    }
    const cliente = await prisma.cliente.create({
      data: {
        nombres: c.nombres,
        apellidos: c.apellidos,
        identificacion: c.identificacion,
        genero: c.genero ?? null,
        fechaNacimiento: fecha(c.fechaNacimiento),
        ciudad: c.ciudad,
        direccion: c.direccion,
        email: c.email,
        celular: c.celular,
        telefono: c.telefono,
        revisar: c.revisar,
        revisarMotivo: c.revisarMotivo,
        organizationId: org.id,
        ejecutivoId,
        ejecutivoNombre: c.ejecutivoNombre,
        dependientes: {
          create: c.dependientes.map((d) => ({
            nombres: d.nombres,
            apellidos: d.apellidos,
            identificacion: d.identificacion,
            fechaNacimiento: fecha(d.fechaNacimiento),
            parentesco: d.parentesco
          }))
        }
      },
      include: { dependientes: true }
    });
    const idPorClave = /* @__PURE__ */ new Map();
    c.dependientes.forEach((d, i) => {
      const creado = cliente.dependientes[i];
      if (creado) idPorClave.set(d.clave, creado.id);
    });
    for (const p of c.polizas) {
      await prisma.poliza.create({
        data: {
          numeroContrato: p.numeroContrato,
          estado: p.estado ?? null,
          aseguradora: p.aseguradora,
          plan: p.plan,
          deducible: p.deducible,
          formaPago: p.formaPago ?? null,
          fechaEmision: fecha(p.fechaEmision),
          primaNeta: p.primaNeta,
          agenteNombre: p.agenteNombre,
          revisar: p.revisar,
          revisarMotivo: p.revisarMotivo,
          clienteId: cliente.id,
          organizationId: org.id,
          dependientes: {
            create: p.cubre.map((clave) => idPorClave.get(clave)).filter((id) => Boolean(id)).map((dependienteId) => ({ dependienteId }))
          }
        }
      });
    }
    nuevos++;
  }
  const marcados = await prisma.cliente.count({ where: { organizationId: org.id, revisar: true } });
  cap("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  cap(`Usuarios procesados ..... ${usuariosCreados.length}`);
  cap(`Clientes nuevos ......... ${nuevos}`);
  cap(`Clientes ya existentes .. ${yaExistian}`);
  cap(`Marcados "por revisar" .. ${marcados}`);
  if (sinEjecutivo.length) {
    cap("SIN EJECUTIVO ASIGNADO (no los ver\xE1 ninguna ejecutiva):");
    sinEjecutivo.forEach((x) => cap(`  - ${x}`));
  }
  return _log;
}
async function enviarReporte(asunto, cuerpo) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SEED_REPORT_EMAIL || "josuex_99@hotmail.com";
  if (!apiKey) {
    console.log("###SEED### sin RESEND_API_KEY");
    return;
  }
  try {
    const { Resend } = require("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Priority CRM <leads@priorityhealth.ec>",
      to: [to],
      subject: asunto,
      html: '<pre style="white-space:pre-wrap;font-family:monospace">' + cuerpo + "</pre>"
    });
    console.log(error ? "###SEED### email fallo: " + JSON.stringify(error) : "###SEED### email enviado a " + to);
  } catch (e) {
    console.log("###SEED### no se pudo enviar email: " + e.message);
  }
}
async function main() {
  try {
    const logs = await runSeed();
    await enviarReporte("Seed operaciones: OK", logs.join("\n"));
  } catch (e) {
    const err = e;
    const detalle = "###SEED### SEED FALLO: " + err.message + "\n\n" + (err.stack ?? "");
    console.log(detalle);
    await enviarReporte("Seed operaciones: FALLO", detalle);
  } finally {
    await prisma.$disconnect();
  }
}
main();
