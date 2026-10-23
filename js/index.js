import { testeConflitos } from '../src/regras/agenda.js';

const CHAVE_RESERVAS = 'agendaStudioRita.reservas';
const reservas = carregarReservas();
const HORARIO_FECHAMENTO = 18 * 60;
const INICIO_ALMOCO = 12 * 60;
const FIM_ALMOCO = 13 * 60 + 30;
const listaAgendamentos = document.querySelector("#lista-agendamentos");
const agendar = document.querySelector("#agendar");
const painel = document.querySelector("#painel");
const botaoVoltar = document.querySelector("#botao-voltar");
const diaSem = document.querySelector("#dia-sem");

// funçôes do painel administrador
function mostrarAgendamentos() {
     listaAgendamentos.innerHTML = "";

    if (diaSem.value === "") {
        return;
    }

    const partes = diaSem.value.split("-");
    const diaEscolhido = partes[2] + "/" + partes[1] + "/" + partes[0];

    const reservasDoDia = reservas
        .filter(reserva => reserva.dia === diaEscolhido)
        .sort((a, b) => a.horario.localeCompare(b.horario));

    if (reservasDoDia.length === 0) {
        listaAgendamentos.textContent = "Nenhum agendamento nesse dia.";
        return;
    }

    reservasDoDia.forEach(reserva => {
        const linha = document.createElement("p");
        linha.textContent =
            reserva.horario + " — " +
            reserva.nome + " — " +
            reserva.telefone + " — " +
            reserva.servico;

        const cartao = document.createElement("div");
        cartao.className = "agendamento";

        if(reserva.concluida) {
            linha.classList.add("concluido");
            cartao.append(linha);
        }
        else {
        
        const botaoCancelar = document.createElement("button");
        botaoCancelar.type = "button";
        botaoCancelar.textContent = "Cancelar";
        botaoCancelar.addEventListener("click", () => cancelarReserva(reserva));
        
        const botaoConcluir = document.createElement("button");
        botaoConcluir.type = "button";
        botaoConcluir.textContent = reserva.concluida ? "concluido" : "concluir";
        botaoConcluir.disabled = reserva.concluida;
        botaoConcluir.addEventListener("click", () => {
            reserva.concluida = true;
            salvarReservas();
            mostrarAgendamentos();
        });

        cartao.append(linha, botaoCancelar, botaoConcluir);
        }
        listaAgendamentos.append(cartao);
    });
}

async function cancelarReserva(reserva) {
    if (!reserva.id) {
        alert('Não foi possível identificar o agendamento. Recarregue a página e tente novamente.');
        return;
    }
    await alterarReservas(() => {
        const posicao = reservas.findIndex(atual => atual.id === reserva.id);
        if (posicao === -1) {
            alert('Este agendamento já foi removido. A agenda foi atualizada.');
            return;
        }
        reservas.splice(posicao, 1);
        salvarReservas();
    });
}

function concluirReserva(reserva) {
    const posicao = reservas.indexof(reserva);

    if(posicao === -1) {
        return;
    }

    reserva[posicao].concluida = true;
    salvarReservas();
    mostrarAgendamentos();
}

function OcultarTelaPrincipal() {
    const painelAbrindo = window.location.hash === "#painel";

    agendar.hidden = painelAbrindo;
    painel.hidden = !painelAbrindo;

    if (painelAbrindo) {
        mostrarAgendamentos();
    }
}

function carregarReservas(interromperEmErro = false) {
    try {
        const reservasSalvas = JSON.parse(localStorage.getItem(CHAVE_RESERVAS) || '[]');
        if (!Array.isArray(reservasSalvas)) {
            throw new Error('Os agendamentos salvos têm formato inválido.');
        }

        const reservasNormalizadas = reservasSalvas.map(reserva => {
            const inicioAntigo = Number(reserva.inicio);
            const duracao = Number(reserva.duracao) || Number(reserva.fim) - inicioAntigo;
            const horario = reserva.horario || formatarMinutosComoHorario(inicioAntigo);

            return {
                id: reserva.id,
                servico: reserva.servico || 'Reserva anterior',
                dia: reserva.dia,horario,duracao,
                nome: reserva.nome || '',
                telefone: reserva.telefone || '',
                concluida: reserva.concluida === true
            };
        });

        return reservasNormalizadas;
    } catch (erro) {
        console.error('Não foi possível carregar os horários salvos.', erro);
        if (interromperEmErro) throw erro;
        return [];
    }
}

function salvarReservas() {
    localStorage.setItem(CHAVE_RESERVAS, JSON.stringify(reservas));
}

// O mesmo bloqueio coordena agendamentos e cancelamentos entre abas da mesma origem.
async function alterarReservas(acao) {
    if (!navigator.locks) {
        alert('Para alterar a agenda com segurança, abra o sistema em HTTPS ou localhost em um navegador atualizado.');
        return;
    }

    try {
        await navigator.locks.request(CHAVE_RESERVAS, () => {
            reservas.splice(0, reservas.length, ...carregarReservas(true));
            const anteriores = reservas.slice();
            try {
                acao();
            } catch (erro) {
                reservas.splice(0, reservas.length, ...anteriores);
                throw erro;
            } finally {
                atualizarHorariosIndisponiveis();
                if (window.location.hash === '#painel') mostrarAgendamentos();
            }
        });
    } catch (erro) {
        console.error('Não foi possível atualizar a agenda.', erro);
        alert('Não foi possível salvar a alteração. Tente novamente.');
    }
}

function temConflito(agendamento) {
    return testeConflitos({
        dia: agendamento.dia,
        inicio: converterHorarioParaMinutos(agendamento.horario),
        duracao: Number(agendamento.duracao)
    }, reservas.map(reserva => ({
        dia: reserva.dia,
        inicio: converterHorarioParaMinutos(reserva.horario),
        duracao: Number(reserva.duracao)
    })));
}

function converterHorarioParaMinutos(horario) {
    const [horas, minutos] = horario.split(':').map(Number);
    return horas * 60 + minutos;
}

function formatarMinutosComoHorario(minutos) {
    const horas = Math.floor(minutos / 60).toString().padStart(2, '0');
    const restoMinutos = (minutos % 60).toString().padStart(2, '0');
    return `${horas}:${restoMinutos}`;
}

function diaPermiteAtendimento(dia) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dia)) {
        return false;
    }

    const [numeroDia, mes, ano] = dia.split('/').map(Number);
    const data = new Date(ano, mes - 1, numeroDia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 &&
        data.getDate() === numeroDia && data.getDay() !== 0;
}

function validarFormulario() {
    const formularios = document.querySelectorAll('.form');

    formularios.forEach(formulario => {
        formulario.querySelector('[name="dia"]').addEventListener('change', atualizarHorariosIndisponiveis);

        formulario.addEventListener('submit', async function(event) {
            event.preventDefault();
            atualizarHorariosIndisponiveis();

            const dia = formulario.querySelector('[name="dia"]').value;
            if (!diaPermiteAtendimento(dia)) {
                alert('Por favor, selecione um dia de atendimento de segunda a sábado.');
                return;
            }

            const nome = formulario.querySelector('[name="nome"]').value.trim();
            const telefone = formulario.querySelector('[name="telefone"]').value.trim();
            const horarioSelecionado = formulario.querySelector('.btn-horario.checked');
            const duracao = Number(formulario.dataset.duracao);

            if(nome === '' || telefone === ''){
                alert('Por favor, preencha todos os campos antes de enviar o formulário.');
                return;
            }
        
            if(!/^\d+$/.test(telefone)){
                alert('Por favor, insira apenas números no campo de telefone.');
                return;
            }
    
            if(/^[\p{L}\s'\-]+$/u.test(nome) === false){
                alert('Por favor, insira apenas letras no campo de nome.');
                return;
            }
        
            if(nome.length <= 3 || nome.length > 80 || telefone.length < 11){
                alert('Por favor, preencha todos os campos corretamente antes de enviar o formulário. Nome tem que ter mais de 3 caracteres e menos de 80. Telefone tem que ter no mínimo 11 números no formato (ddd) 9XXXX-XXXX.');
                return;
            }

            if(!horarioSelecionado){
                alert('Por favor, selecione um horário.');
                return;
            }

            const agendamento = {
                servico: formulario.querySelector('[name="servico"]').value,
                dia,
                horario: horarioSelecionado.innerText,
                duracao,
                nome,
                telefone,
                concluida: false
            };

            await alterarReservas(() => {
                if (temConflito(agendamento)) {
                    alert('Este horário acabou de ser reservado. Selecione outro horário.');
                    return;
                }
                agendamento.id = crypto.randomUUID();
                reservas.push(agendamento);
                salvarReservas();
                horarioSelecionado.classList.remove('checked');
            });
        });
    });
}

// Função para exibir os horarios disponíveis para agendamento no HTML

function exibirHorariosDisponiveis() {
    const containerHorarios = document.querySelectorAll(".horas");

    containerHorarios.forEach(container => {
        for(let i = 9; i <= 18; i++){

            let minutos = ["00", "30"];

            for(let m of minutos){
                if(i === 18 && m === "30"){
                    continue;
                }

                let horaFormatada = i.toString().padStart(2, '0') + ':' + m;

                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'hora btn-horario';
                botao.innerText = horaFormatada;
                botao.onclick = function() { selecionarHorario(this); };

                container.appendChild(botao);
            }
        }
    });

    atualizarHorariosIndisponiveis();
}

function atualizarHorariosIndisponiveis() {
    document.querySelectorAll('.form').forEach(formulario => {
        const dia = formulario.querySelector('[name="dia"]').value;
        const duracao = Number(formulario.dataset.duracao);
        const containerHorarios = formulario.querySelector('.horas');

        containerHorarios.querySelectorAll('.btn-horario').forEach(botao => {
            const inicio = converterHorarioParaMinutos(botao.innerText);
            const fim = inicio + duracao;
            const passaDoFechamento = fim > HORARIO_FECHAMENTO;
            const invadeAlmoco = inicio < FIM_ALMOCO && fim > INICIO_ALMOCO;
            const horarioReservado = temConflito({ dia, horario: botao.innerText, duracao });

            botao.hidden = !diaPermiteAtendimento(dia) || invadeAlmoco || passaDoFechamento || horarioReservado;
            if (botao.hidden) {
                botao.classList.remove('checked');
            }
        });

        let mensagem = containerHorarios.querySelector('.mensagem-sem-horarios');
        if (!mensagem) {
            mensagem = document.createElement('p');
            mensagem.className = 'mensagem-sem-horarios';
            mensagem.setAttribute('role', 'status');
            mensagem.textContent = 'Não há horários disponíveis para este dia.';
            containerHorarios.appendChild(mensagem);
        }

        const temHorarioDisponivel = Array.from(containerHorarios.querySelectorAll('.btn-horario'))
            .some(botao => !botao.hidden);
        mensagem.hidden = temHorarioDisponivel;
    });
}

function selecionarHorario(botao) {
    if (botao.hidden) {
        return;
    }

    const containerHorarios = botao.closest('.horas');
    const estavaSelecionado = botao.classList.contains('checked');

    containerHorarios.querySelectorAll('.btn-horario').forEach(horario => {
        horario.classList.remove('checked');
    });

    if (estavaSelecionado) {
        return;
    }

    botao.classList.add('checked');
}

function dataAtualDeAgendamento() {
    const dataAtual = new Date();
    const diaSemana = dataAtual.getDay();
    const segundaFeira = new Date(dataAtual);
    segundaFeira.setDate(dataAtual.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));

    document.querySelectorAll('.dia').forEach((elementoData) => {
        const hoje = new Date(dataAtual);
        hoje.setHours(0, 0, 0, 0);

        for (let i = 0; i < 6; i++) {
            const data = new Date(segundaFeira);
            data.setDate(segundaFeira.getDate() + i);
            if (data < hoje) continue;

            const dataFormatada = data.toLocaleDateString('pt-BR');
            const option = document.createElement('option');
            option.value = dataFormatada;
            option.textContent = dataFormatada;
            elementoData.appendChild(option);
        }
    });
}
window.addEventListener("hashchange", OcultarTelaPrincipal);

botaoVoltar.addEventListener("click", () => {
    window.location.hash = "#agendar";
});


async function inicializarAgenda() {
    if (reservas.some(reserva => !reserva.id)) {
        // Releitura e migração ficam no mesmo bloqueio usado nas demais gravações.
        await alterarReservas(() => {
            const migradas = reservas.map(reserva => ({
                ...reserva,
                id: reserva.id || crypto.randomUUID()
            }));
            reservas.splice(0, reservas.length, ...migradas);
            salvarReservas();
        });
    }

    diaSem.addEventListener("change", mostrarAgendamentos);
    OcultarTelaPrincipal();
    dataAtualDeAgendamento();
    exibirHorariosDisponiveis();
    validarFormulario();
}

const inicializacao = inicializarAgenda();
