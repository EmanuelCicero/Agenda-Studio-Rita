import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { testeConflitos } from '../src/regras/agenda.js';

const codigo = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
    .replace("import { testeConflitos } from '../src/regras/agenda.js';", '');

// DOM mínimo para exercitar a inicialização e os eventos sem dependências externas.
function elemento() {
    const classes = new Set();
    return {
        value: '', hidden: false, children: [], eventos: {},
        classList: {
            add: classe => classes.add(classe),
            remove: classe => classes.delete(classe),
            contains: classe => classes.has(classe)
        },
        appendChild(filho) {
            this.children.push(filho);
            if (filho.value && !this.value) this.value = filho.value;
        },
        setAttribute() {},
        addEventListener(nome, callback) { this.eventos[nome] = callback; },
        querySelectorAll(seletor) {
            return this.children.filter(filho =>
                seletor === '.btn-horario' && filho.className === 'hora btn-horario');
        },
        querySelector(seletor) {
            return this.children.find(filho => filho.className === seletor.slice(1));
        }
    };
}

function armazenamentoCompartilhado(reservas = []) {
    let valor = JSON.stringify(reservas);
    let fila = Promise.resolve();
    let bloqueado = false;
    const gravacoes = [];
    return {
        gravacoes,
        localStorage: {
            getItem: () => valor,
            setItem(chave, novoValor) {
                assert.equal(chave, 'agendaStudioRita.reservas');
                assert.ok(bloqueado, 'Toda gravação deve acontecer dentro do bloqueio');
                valor = novoValor;
                gravacoes.push(JSON.parse(valor));
            }
        },
        locks: {
            request(chave, callback) {
                assert.equal(chave, 'agendaStudioRita.reservas');
                const operacao = fila.then(async () => {
                    bloqueado = true;
                    try {
                        return await callback();
                    } finally {
                        bloqueado = false;
                    }
                });
                fila = operacao.catch(() => {});
                return operacao;
            }
        }
    };
}

async function abrirPagina(data = '2026-10-22', reservas = [], armazenamento = armazenamentoCompartilhado(reservas)) {
    const formularios = [60, 30, 30, 90].map((duracao, indice) => {
        const formulario = elemento();
        formulario.dataset = { duracao: String(duracao) };
        formulario.horas = elemento();
        formulario.campos = {
            dia: elemento(), nome: { value: 'Maria Silva' },
            telefone: { value: '88999999999' },
            servico: { value: ['Corte', 'Escova', 'Manicure', 'Coloração'][indice] }
        };
        formulario.querySelector = seletor => {
            if (seletor === '.horas') return formulario.horas;
            if (seletor === '.btn-horario.checked') {
                return formulario.horas.children.find(botao => botao.classList.contains('checked'));
            }
            return formulario.campos[seletor.match(/name="([^"]+)"/)[1]];
        };
        return formulario;
    });
    const ids = Object.fromEntries(
        ['lista-agendamentos', 'agendar', 'painel', 'botao-voltar', 'dia-sem']
            .map(id => [`#${id}`, elemento()])
    );
    const alertas = [];
    const { gravacoes } = armazenamento;
    const contexto = {
        testeConflitos,
        crypto: { randomUUID },
        navigator: { locks: armazenamento.locks },
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : [`${data}T10:00:00`])); }
        },
        document: {
            querySelector: seletor => ids[seletor],
            querySelectorAll: seletor => seletor === '.form' ? formularios :
                formularios.map(formulario => seletor === '.dia' ? formulario.campos.dia : formulario.horas),
            createElement: elemento
        },
        window: { location: { hash: '' }, addEventListener() {} },
        localStorage: armazenamento.localStorage,
        alert: mensagem => alertas.push(mensagem), console
    };
    runInNewContext(codigo, contexto);
    await runInNewContext('inicializacao', contexto);
    return { formularios, alertas, gravacoes, contexto };
}

function disponivel(formulario, horario) {
    return !formulario.horas.children.find(botao => botao.innerText === horario).hidden;
}

test('RF02: reservas salvas bloqueiam os serviços já na abertura', async () => {
    const { formularios } = await abrirPagina(undefined, [
        { dia: '22/10/2026', horario: '10:00', duracao: 60, servico: 'Corte' }
    ]);
    assert.equal(formularios[1].campos.dia.value, '22/10/2026');
    assert.equal(disponivel(formularios[1], '10:00'), false);
    assert.equal(disponivel(formularios[1], '10:30'), false);
    assert.equal(disponivel(formularios[1], '11:00'), true);
    formularios[1].campos.dia.value = '23/10/2026';
    formularios[1].campos.dia.eventos.change();
    assert.equal(disponivel(formularios[1], '10:00'), true);
});

test('RF02: almoço considera a duração e permite terminar exatamente às 12h', async () => {
    const { formularios: [corte, escova, , coloracao] } = await abrirPagina();
    assert.equal(disponivel(corte, '11:00'), true);
    assert.equal(disponivel(corte, '11:30'), false);
    assert.equal(disponivel(escova, '11:30'), true);
    assert.equal(disponivel(coloracao, '10:30'), true);
    assert.equal(disponivel(coloracao, '11:00'), false);
    assert.equal(disponivel(coloracao, '11:30'), false);
    for (const formulario of [corte, escova, coloracao]) {
        for (const horario of ['12:00', '12:30', '13:00']) {
            assert.equal(disponivel(formulario, horario), false);
        }
        assert.equal(disponivel(formulario, '13:30'), true);
    }
});

test('RF02: todos os serviços respeitam o fechamento às 18h', async () => {
    const { formularios } = await abrirPagina();
    const ultimos = ['17:00', '17:30', '17:30', '16:30'];
    formularios.forEach((formulario, indice) => {
        assert.equal(disponivel(formulario, ultimos[indice]), true);
        const posteriores = formulario.horas.querySelectorAll('.btn-horario')
            .filter(botao => botao.innerText > ultimos[indice]);
        assert.ok(posteriores.every(botao => botao.hidden));
    });
});

test('RF02: domingo sem datas disponíveis não oferece nem salva horários', async () => {
    const { formularios, gravacoes, alertas } = await abrirPagina('2026-10-25');
    for (const formulario of formularios) {
        assert.equal(formulario.campos.dia.value, '');
        assert.ok(formulario.horas.querySelectorAll('.btn-horario').every(botao => botao.hidden));
        assert.equal(formulario.horas.querySelector('.mensagem-sem-horarios').hidden, false);
        formulario.eventos.submit({ preventDefault() {} });
    }
    assert.equal(gravacoes.length, 0);
    assert.equal(alertas.length, 4);
});

test('RF02: data de domingo ou inválida esconde horários e limpa seleção', async () => {
    const { formularios: [formulario] } = await abrirPagina();
    for (const dia of ['25/10/2026', '31/02/2026', '']) {
        const botao = formulario.horas.children.find(botao => botao.innerText === '09:00');
        botao.classList.add('checked');
        formulario.campos.dia.value = dia;
        formulario.campos.dia.eventos.change();
        assert.ok(formulario.horas.querySelectorAll('.btn-horario').every(horario => horario.hidden));
        assert.equal(botao.classList.contains('checked'), false);
    }
});

function agendar(pagina, indice, horario) {
    const formulario = pagina.formularios[indice];
    formulario.horas.children.find(botao => botao.innerText === horario).classList.add('checked');
    return formulario.eventos.submit({ preventDefault() {} });
}

test('RF04: impede sobreposição entre serviços no envio e permite horários consecutivos', async () => {
    const pagina = await abrirPagina();
    await agendar(pagina, 0, '10:00');
    await agendar(pagina, 1, '10:30');
    assert.equal(pagina.gravacoes.length, 1);
    await agendar(pagina, 1, '11:00');
    assert.equal(pagina.gravacoes.length, 2);
    assert.equal(pagina.gravacoes[1].length, 2);
});

test('RF04: envios simultâneos em abas diferentes salvam apenas uma reserva conflitante', async () => {
    const armazenamento = armazenamentoCompartilhado();
    const primeira = await abrirPagina(undefined, [], armazenamento);
    const segunda = await abrirPagina(undefined, [], armazenamento);
    await Promise.all([agendar(primeira, 0, '10:00'), agendar(segunda, 1, '10:30')]);
    assert.equal(armazenamento.gravacoes.length, 1);
    assert.equal(armazenamento.gravacoes[0][0].servico, 'Corte');
    assert.match(segunda.alertas[0], /acabou de ser reservado/);
    assert.equal(disponivel(segunda.formularios[1], '10:30'), false);
});

test('RF04: abas preservam reservas não conflitantes e permitem o mesmo horário em dias distintos', async () => {
    const armazenamento = armazenamentoCompartilhado();
    const primeira = await abrirPagina(undefined, [], armazenamento);
    const segunda = await abrirPagina(undefined, [], armazenamento);
    segunda.formularios[1].campos.dia.value = '23/10/2026';
    await Promise.all([agendar(primeira, 0, '10:00'), agendar(segunda, 1, '10:00')]);
    assert.equal(armazenamento.gravacoes.at(-1).length, 2);
});

test('RF04: falha ao gravar mantém horário livre e avisa a cliente', async () => {
    const armazenamento = armazenamentoCompartilhado();
    armazenamento.localStorage.setItem = () => { throw new Error('Sem espaço'); };
    const pagina = await abrirPagina(undefined, [], armazenamento);
    pagina.contexto.console = { error() {} };
    await agendar(pagina, 0, '10:00');
    assert.equal(pagina.gravacoes.length, 0);
    assert.equal(disponivel(pagina.formularios[0], '10:00'), true);
    assert.match(pagina.alertas[0], /Não foi possível salvar/);
});

test('RF04: leitura indisponível impede gravar por cima de reservas desconhecidas', async () => {
    const armazenamento = armazenamentoCompartilhado();
    const pagina = await abrirPagina(undefined, [], armazenamento);
    pagina.contexto.console = { error() {} };
    armazenamento.localStorage.getItem = () => { throw new Error('Armazenamento indisponível'); };
    await agendar(pagina, 0, '10:00');
    assert.equal(pagina.gravacoes.length, 0);
    assert.match(pagina.alertas[0], /Não foi possível salvar/);
});

test('RF04: sem bloqueio entre abas a aplicação recusa gravação insegura', async () => {
    const pagina = await abrirPagina();
    pagina.contexto.navigator.locks = undefined;
    await agendar(pagina, 0, '10:00');
    assert.equal(pagina.gravacoes.length, 0);
    assert.match(pagina.alertas[0], /HTTPS ou localhost/);
});

test('RF04: cancelamento libera o horário e preserva reserva simultânea de outra aba', async () => {
    const reserva = { id: 'reserva-original', dia: '22/10/2026', horario: '10:00', duracao: 60, servico: 'Corte' };
    const armazenamento = armazenamentoCompartilhado([reserva]);
    const primeira = await abrirPagina(undefined, [], armazenamento);
    const segunda = await abrirPagina(undefined, [], armazenamento);
    await Promise.all([
        agendar(segunda, 1, '11:00'),
        primeira.contexto.cancelarReserva(reserva)
    ]);
    const salvas = JSON.parse(armazenamento.localStorage.getItem());
    assert.equal(salvas.length, 1);
    assert.equal(salvas[0].horario, '11:00');
    assert.equal(disponivel(primeira.formularios[0], '10:00'), true);
    assert.equal(disponivel(primeira.formularios[1], '11:00'), false);
});

test('RF04: falha no cancelamento preserva a reserva e mantém o horário ocupado', async () => {
    const reserva = { id: 'reserva-original', dia: '22/10/2026', horario: '10:00', duracao: 60, servico: 'Corte' };
    const armazenamento = armazenamentoCompartilhado([reserva]);
    const pagina = await abrirPagina(undefined, [], armazenamento);
    pagina.contexto.console = { error() {} };
    armazenamento.localStorage.setItem = () => { throw new Error('Sem acesso'); };
    await pagina.contexto.cancelarReserva(reserva);
    assert.equal(disponivel(pagina.formularios[0], '10:00'), false);
    assert.equal(JSON.parse(armazenamento.localStorage.getItem()).length, 1);
    assert.match(pagina.alertas[0], /Não foi possível salvar/);
});

test('RF04: cartão antigo não cancela nova reserva no mesmo dia e horário', async () => {
    const antiga = {
        id: randomUUID(), dia: '22/10/2026', horario: '10:00', duracao: 60,
        servico: 'Corte', nome: 'Maria Silva', telefone: '88999999999'
    };
    const armazenamento = armazenamentoCompartilhado([antiga]);
    const primeira = await abrirPagina(undefined, [], armazenamento);
    const segunda = await abrirPagina(undefined, [], armazenamento);
    await segunda.contexto.cancelarReserva(antiga);
    await agendar(segunda, 0, '10:00');
    const nova = JSON.parse(armazenamento.localStorage.getItem())[0];
    assert.notEqual(nova.id, antiga.id);
    await primeira.contexto.cancelarReserva(antiga);
    assert.deepEqual(JSON.parse(armazenamento.localStorage.getItem()), [nova]);
    assert.match(primeira.alertas[0], /já foi removido/);
    const recarregada = await abrirPagina(undefined, [], armazenamento);
    assert.equal(recarregada.contexto.carregarReservas()[0].id, nova.id);
});

test('RF04: migração aguarda o bloqueio e preserva alterações feitas antes de adquiri-lo', async () => {
    const armazenamento = armazenamentoCompartilhado([
        { dia: '22/10/2026', inicio: 600, fim: 660, servico: 'Corte' }
    ]);
    let liberar;
    const espera = new Promise(resolve => { liberar = resolve; });
    const chave = 'agendaStudioRita.reservas';
    const bloqueio = armazenamento.locks.request(chave, () => espera);
    await Promise.resolve();
    const nova = { id: randomUUID(), dia: '23/10/2026', horario: '11:00', duracao: 30 };
    const atualizacao = armazenamento.locks.request(chave, () => {
        const salvas = JSON.parse(armazenamento.localStorage.getItem());
        armazenamento.localStorage.setItem(chave, JSON.stringify([...salvas, nova]));
    });
    const aberturaA = abrirPagina(undefined, [], armazenamento);
    const aberturaB = abrirPagina(undefined, [], armazenamento);
    assert.equal(armazenamento.gravacoes.length, 0);
    liberar();
    const [, , primeira, segunda] = await Promise.all([bloqueio, atualizacao, aberturaA, aberturaB]);
    const salvas = JSON.parse(armazenamento.localStorage.getItem());
    assert.equal(salvas.length, 2);
    assert.equal(new Set(salvas.map(reserva => reserva.id)).size, 2);
    assert.ok(salvas[0].id);
    assert.equal(salvas[0].horario, '10:00');
    assert.equal(salvas[0].duracao, 60);
    assert.equal('inicio' in salvas[0], false);
    assert.equal(salvas[1].id, nova.id);
    assert.equal(primeira.contexto.carregarReservas()[0].id, salvas[0].id);
    assert.equal(segunda.contexto.carregarReservas()[0].id, salvas[0].id);
    await primeira.contexto.cancelarReserva(primeira.contexto.carregarReservas()[0]);
    assert.equal(JSON.parse(armazenamento.localStorage.getItem())[0].id, nova.id);
});

test('RF04: leitura normaliza dados legados sem gravar no armazenamento', async () => {
    const armazenamento = armazenamentoCompartilhado();
    const pagina = await abrirPagina(undefined, [], armazenamento);
    armazenamento.localStorage.getItem = () => JSON.stringify([
        { dia: '22/10/2026', inicio: 600, fim: 660 }
    ]);
    const [reserva] = pagina.contexto.carregarReservas(true);
    assert.equal(reserva.horario, '10:00');
    assert.equal(reserva.duracao, 60);
    assert.equal(armazenamento.gravacoes.length, 0);
});
