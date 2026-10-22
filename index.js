const guardarAgendamentos = "agendamentos";
const formularios = document.querySelectorAll(".form");
const listaAgendamentos = document.querySelector("#lista-agendamentos");
const agendar = document.querySelector("#agendar");
const painel = document.querySelector("#painel");
const botaoVoltar = document.querySelector("#botao-voltar");

function carregarAgendamentos() {
    const registroSalvo = localStorage.getItem(guardarAgendamentos);
    return registroSalvo ? JSON.parse(registroSalvo) : [];
}

function salvarAgendamentos(agendamentos) {
    localStorage.setItem(guardarAgendamentos, JSON.stringify(agendamentos));
}

function mostrarAgendamentos() {
    /* Evita que o painel multiplique os dados cada vez que abre*/
    listaAgendamentos.innerHTML = "";
    carregarAgendamentos().forEach(agendamento => {
        const linha = document.createElement("p");
        linha.textContent = agendamento.nome + " — " + agendamento.telefone + " — " + agendamento.servico + " — " + agendamento.dia + " — " + agendamento.dia + " — " + agendamento.hora;
        listaAgendamentos.append(linha);
    });
}

formularios.forEach(formulario => {
    formulario.addEventListener("submit", evento => {

        const dados = new FormData(formulario);
        const agendamentos = carregarAgendamentos();

        agendamentos.push({
            nome: dados.get("nome"),
            telefone: dados.get("telefone"),
            servico: dados.get("servico"),
            dia: dados.get("dia"),
            hora: dados.get("hora")
        });

        salvarAgendamentos(agendamentos);
    });
});
/* Ocultar o conteudo principal e deixa visivel apenas o painel*/
function OcultarTelaPrincipal() {
    const painelAbrindo = window.location.hash === "#painel";

    agendar.hidden = painelAbrindo;
    painel.hidden = !painelAbrindo;

    if (painelAbrindo) {
        mostrarAgendamentos();
    }
}

window.addEventListener("hashchange", OcultarTelaPrincipal);

botaoVoltar.addEventListener("click", () => {
    window.location.hash = "#agendar";
});

OcultarTelaPrincipal();