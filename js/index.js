// Criação de validação para o formulário de cadastro de nome e telefone
function validarFormulario() {

    const nomeInput = document.getElementById('nome');
    const telefoneInput = document.getElementById('telefone');
    
    const botãoEnviarFormulario = document.getElementById('botao-enviar');
    
    botãoEnviarFormulario.addEventListener('click', function(event){
        event.preventDefault();
        const nome = nomeInput.value;
        const telefone = telefoneInput.value;

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
    });
}

//Chamada de funções
validarFormulario();