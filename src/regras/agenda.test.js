import { test } from "node:test";
import assert from "node:assert/strict";
import { testeConflitos } from "./agenda.js";

test("detecta conflito entre corte das 10h e escova de 10h30", () => {
    const marcados = [{ inicio: 600, duracao: 60 }];
    const novo = { inicio: 630, duracao: 30 };

    assert.equal(testeConflitos(novo, marcados), true);
});

test("aceita horários consecutivos", () => {
    const marcados = [{ inicio: 600, duracao: 60 }]; 
    const novo = { inicio: 660, duracao: 30 };

    assert.equal(testeConflitos(novo, marcados), false);
});

test("se não encontra conflito quando não tem agendamentos", () => {
    const marcados = [];
    const novo = { inicio: 600, duracao: 30 };

    assert.equal(testeConflitos(novo, marcados), false);
});

test("detecta conflito quando começam no mesmo horário", () => {
    const marcados = [{ inicio: 600, duracao: 60 }];
    const novo = { inicio: 600, duracao: 30 };

    assert.equal(testeConflitos(novo, marcados), true);
});

test("detecta sobreposição de dois horários", () => {
    const marcados = [{ inicio: 630, duracao: 30 }]; // 10h30 - 11h
    const novo = { inicio: 600, duracao: 60 };       // 10h - 11h

    assert.equal(testeConflitos(novo, marcados), true);
});

test("detecta conflito quando o novo horário termina depois de um já marcado", () => {
    const marcados = [{ inicio: 600, duracao: 60 }]; // 10h - 11h
    const novo = { inicio: 630, duracao: 60 };       // 10h30 - 11h30

    assert.equal(testeConflitos(novo, marcados), true);
});

test("se aceita horário que termina quando outro começa", () => {
    const marcados = [{ inicio: 600, duracao: 60 }]; // 10h - 11h
    const novo = { inicio: 570, duracao: 30 };       // 9h30 - 10h

    assert.equal(testeConflitos(novo, marcados), false);
});

test("verifica conflito com qualquer agendamento", () => {
    const marcados = [
        { inicio: 600, duracao: 30 }, // 10h - 10h30
        { inicio: 660, duracao: 60 }  // 11h às 12h
    ];
    const novo = { inicio: 690, duracao: 30 }; // 11h30 - 12h

    assert.equal(testeConflitos(novo, marcados), true);
});

test("permite o mesmo horário em dias diferentes", () => {
    assert.equal(testeConflitos(
        { dia: '22/10/2026', inicio: 600, duracao: 60 },
        [{ dia: '23/10/2026', inicio: 600, duracao: 60 }]
    ), false);
});

test("detecta atendimento contido em outro sem alterar as entradas", () => {
    const novo = Object.freeze({ dia: '22/10/2026', inicio: 630, duracao: 30 });
    const marcados = Object.freeze([
        Object.freeze({ dia: '22/10/2026', inicio: 600, duracao: 90 })
    ]);
    assert.equal(testeConflitos(novo, marcados), true);
    assert.equal(testeConflitos(novo, marcados), true);
});
