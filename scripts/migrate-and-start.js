#!/usr/bin/env node
/**
 * Entrypoint de produção: garante o provider Postgres, aplica as migrations
 * versionadas (nunca `db push --accept-data-loss`) e sobe o servidor.
 *
 * Adoção segura em banco QUE JÁ EXISTE (criado antes por db push):
 *  1. `migrate deploy` — num banco vazio, cria tudo a partir de 0_init.
 *  2. Se o banco já tem as tabelas (sem histórico de migration), o deploy
 *     falha com P3005 ("schema não vazio"). Nesse caso fazemos o BASELINE:
 *     marcamos 0_init como já aplicada (`migrate resolve --applied 0_init`)
 *     e rodamos o deploy de novo — que então só aplica migrations futuras.
 *
 * Depois do primeiro boot, o histórico fica registrado e os deploys
 * seguintes só aplicam o que for novo, sem baseline.
 */
import { execSync } from "child_process";

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function tryRun(cmd) {
  try {
    run(cmd);
    return true;
  } catch {
    return false;
  }
}

// 1. Provider correto (o repo versiona sqlite p/ dev; produção é postgres).
run("node scripts/switch-db.js postgresql");
run("npx prisma generate");

// 2. Aplica migrations. Baseline automático se o banco já existir.
const deployed = tryRun("npx prisma migrate deploy");
if (!deployed) {
  console.warn(
    "\n[migrate] deploy falhou — provavelmente banco pré-existente sem histórico.\n" +
    "[migrate] Fazendo baseline de 0_init e tentando de novo…"
  );
  // Baseline: registra a migration inicial como já aplicada (não recria nada).
  tryRun("npx prisma migrate resolve --applied 0_init");
  // Segundo deploy: agora só aplica migrations além da baseline (nenhuma no 1º boot).
  run("npx prisma migrate deploy");
}

// 3. Sobe o servidor (substitui o processo).
console.log("\n[migrate] OK. Iniciando servidor…");
run("node server.js");
