const CHAVE_RESERVAS = 'agendaStudioRita.reservas';
const reservas = carregarReservas();
const HORARIO_FECHAMENTO = 18 * 60;

function carregarReservas() {
    try {
        const reservasSalvas = JSON.parse(localStorage.getItem(CHAVE_RESERVAS) || '[]');
        if (!Array.isArray(reservasSalvas)) {
            return [];
        }

        const reservasNormalizadas = reservasSalvas.map(reserva => {
            const inicioAntigo = Number(reserva.inicio);
            const duracao = Number(reserva.duracao) || Number(reserva.fim) - inicioAntigo;
            const horario = reserva.horario || formatarMinutosComoHorario(inicioAntigo);

            return {
                servico: reserva.servico || 'Reserva anterior',
                dia: reserva.dia,
                horario,
                duracao,
                nome: reserva.nome || '',
                telefone: reserva.telefone || ''
            };
        });

        if (reservasSalvas.some(reserva => 'inicio' in reserva || 'fim' in reserva)) {
            localStorage.setItem(CHAVE_RESERVAS, JSON.stringify(reservasNormalizadas));
        }

        return reservasNormalizadas;
    } catch (erro) {
        console.error('Não foi possível carregar os horários salvos.', erro);
        return [];
    }
}

function salvarReservas() {
    try {
        localStorage.setItem(CHAVE_RESERVAS, JSON.stringify(reservas));
    } catch (erro) {
        console.error('Não foi possível salvar os horários no navegador.', erro);
    }
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

function validarFormulario() {
    const formularios = document.querySelectorAll('.form');

    formularios.forEach(formulario => {
        formulario.querySelector('[name="dia"]').addEventListener('change', atualizarHorariosIndisponiveis);

        formulario.addEventListener('submit', function(event) {
            event.preventDefault();

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

            const dia = formulario.querySelector('[name="dia"]').value;
            const inicio = converterHorarioParaMinutos(horarioSelecionado.innerText);

            const agendamento = {
                servico: formulario.querySelector('[name="servico"]').value,
                dia,
                horario: horarioSelecionado.innerText,
                duracao,
                nome,
                telefone
            };

            reservas.push(agendamento);
            salvarReservas();

            horarioSelecionado.classList.remove('checked');
            atualizarHorariosIndisponiveis();
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

                if(horaFormatada === '12:00' || horaFormatada === "12:30" || horaFormatada === '13:00'){
                    continue;
                }

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
            const horarioReservado = reservas.some(reserva => {
                const inicioReserva = converterHorarioParaMinutos(reserva.horario);
                const fimReserva = inicioReserva + Number(reserva.duracao);
                return reserva.dia === dia && inicio < fimReserva && fim > inicioReserva;
            });

            botao.hidden = passaDoFechamento || horarioReservado;
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

//Chamada de funções
exibirHorariosDisponiveis();
validarFormulario();
dataAtualDeAgendamento();