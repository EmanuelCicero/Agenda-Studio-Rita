import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const codigo = readFileSync(new URL('./index.js', import.meta.url), 'utf8');

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

function abrirPagina(data = '2026-10-22', reservas = []) {
    const formularios = [60, 30, 30, 90].map(duracao => {
        const formulario = elemento();
        formulario.dataset = { duracao: String(duracao) };
        formulario.horas = elemento();
        formulario.campos = {
            dia: elemento(), nome: { value: 'Maria Silva' },
            telefone: { value: '88999999999' }, servico: { value: 'Corte' }
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
    const gravacoes = [];
    const contexto = {
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
        localStorage: {
            getItem: () => JSON.stringify(reservas),
            setItem: (chave, valor) => gravacoes.push(JSON.parse(valor))
        },
        alert: mensagem => alertas.push(mensagem), console
    };
    runInNewContext(codigo, contexto);
    return { formularios, alertas, gravacoes };
}

function disponivel(formulario, horario) {
    return !formulario.horas.children.find(botao => botao.innerText === horario).hidden;
}

test('RF02: reservas salvas bloqueiam os serviços já na abertura', () => {
    const { formularios } = abrirPagina(undefined, [
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

test('RF02: almoço considera a duração e permite terminar exatamente às 12h', () => {
    const { formularios: [corte, escova, , coloracao] } = abrirPagina();
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

test('RF02: todos os serviços respeitam o fechamento às 18h', () => {
    const { formularios } = abrirPagina();
    const ultimos = ['17:00', '17:30', '17:30', '16:30'];
    formularios.forEach((formulario, indice) => {
        assert.equal(disponivel(formulario, ultimos[indice]), true);
        const posteriores = formulario.horas.querySelectorAll('.btn-horario')
            .filter(botao => botao.innerText > ultimos[indice]);
        assert.ok(posteriores.every(botao => botao.hidden));
    });
});

test('RF02: domingo sem datas disponíveis não oferece nem salva horários', () => {
    const { formularios, gravacoes, alertas } = abrirPagina('2026-10-25');
    for (const formulario of formularios) {
        assert.equal(formulario.campos.dia.value, '');
        assert.ok(formulario.horas.querySelectorAll('.btn-horario').every(botao => botao.hidden));
        assert.equal(formulario.horas.querySelector('.mensagem-sem-horarios').hidden, false);
        formulario.eventos.submit({ preventDefault() {} });
    }
    assert.equal(gravacoes.length, 0);
    assert.equal(alertas.length, 4);
});

test('RF02: data de domingo ou inválida esconde horários e limpa seleção', () => {
    const { formularios: [formulario] } = abrirPagina();
    for (const dia of ['25/10/2026', '31/02/2026', '']) {
        const botao = formulario.horas.children.find(botao => botao.innerText === '09:00');
        botao.classList.add('checked');
        formulario.campos.dia.value = dia;
        formulario.campos.dia.eventos.change();
        assert.ok(formulario.horas.querySelectorAll('.btn-horario').every(horario => horario.hidden));
        assert.equal(botao.classList.contains('checked'), false);
    }
});
