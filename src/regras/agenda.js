export function testeConflitos(novo, marcados) {
    return marcados.some(marcado =>
        novo.inicio < marcado.inicio + marcado.duracao &&
        novo.inicio + novo.duracao > marcado.inicio
    );
}