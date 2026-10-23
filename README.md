# 📅 Sistema de Agendamento para Salão de Beleza

Um sistema de agendamento online simples. O projeto permite que clientes visualizem horários disponíveis e agendem serviços de forma autônoma, com agenda semanal.

## 🎯 Objetivo do Projeto
Eliminar a necessidade de agendamentos manuais por mensagem, otimizando o tempo do profissional e oferecendo praticidade para os clientes. Os dados são salvos diretamente no navegador utilizando a API do `localStorage`.

## ✨ Funcionalidades

### 👤 Visão do Cliente
- **Agendamento simplificado:** O cliente precisa informar apenas Nome e Telefone.
- **Visualização de disponibilidade:** Exibição apenas dos horários livres, respeitando o horário de funcionamento (Segunda a Sábado, 09h às 18h, com pausa para almoço).
- **Seleção de Serviços:** Cálculo automático do tempo de bloqueio na agenda baseado no serviço escolhido.

### 🛠️ Visão do Profissional (Admin)
- **Painel Diário:** Visualização da agenda completa do dia.
- **Gerenciamento:** Opção de cancelar agendamentos existentes.

## 📋 Catálogo de Serviços

| Serviço | Duração | Valor |
| :--- | :--- | :--- |
| ✂️ Corte | 1h | R$ 50,00 |
| 🪮 Escova | 30 min | R$ 35,00 |
| 💅 Manicure | 30 min | R$ 25,00 |
| 🎨 Coloração | 1h30 | R$ 120,00 |

## 💻 Tecnologias Utilizadas
- **HTML5 & CSS3:** Estruturação e estilização das interfaces (Cliente e Admin).
- **JavaScript (Vanilla):** Toda a lógica de horários, cálculo de duração de serviços e manipulação do DOM sem uso de frameworks.
- **LocalStorage:** Persistência de dados (agendamentos e bloqueios) no armazenamento local do navegador.

## 🚀 Como executar o projeto localmente

O projeto usa módulos JavaScript e precisa ser servido por HTTP. Para desenvolvimento, use o Live Server do VS Code ou um servidor estático:

1. Clone este repositório em sua máquina:
   ```bash
   git clone https://github.com/EmanuelCicero/Agenda-Studio-Rita.git
   cd Agenda-Studio-Rita
   ```

2. Inicie o Live Server ou, se tiver Python instalado, execute:
   ```bash
   python3 -m http.server 8000
   ```

3. Acesse `http://localhost:8000` em um navegador atualizado.

Agendamentos e cancelamentos usam Web Locks para coordenar gravações entre abas da mesma origem. Esse recurso exige HTTPS ou localhost. Se estiver indisponível, o sistema informa o motivo e impede a alteração da agenda.

Os dados ficam no `localStorage` do navegador. A coordenação entre abas não compartilha a agenda entre dispositivos ou navegadores diferentes.

## 🧪 Como rodar os testes

1. Para executar os testes, abra o terminal na raiz do projeto e rode o comando:
   ```bash
   npm test
   ```
