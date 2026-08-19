import recemNascidoSaudavel   from './recem_nascido_saudavel.png';
import recemNascidoDebilitado from './recem_nascido_debilitado.png';
import recemNascidoCritico    from './recem_nascido_critico.png';
import juvenilSaudavel        from './juvenil_saudavel.png';
import juvenilDebilitado      from './juvenil_debilitado.png';
import juvenilCritico         from './juvenil_critico.png';
import adultoSaudavel         from './adulto_saudavel.png';
import adultoDebilitado       from './adulto_debilitado.png';
import adultoCritico          from './adulto_critico.png';
import idosoSaudavel          from './idoso_saudavel.png';
import idosoDebilitado        from './idoso_debilitado.png';
import idosoCritico           from './idoso_critico.png';

export const MASCOT_IMAGES = {
  RECEM_NASCIDO: { saudavel: recemNascidoSaudavel, debilitado: recemNascidoDebilitado, critico: recemNascidoCritico },
  JUVENIL:       { saudavel: juvenilSaudavel,       debilitado: juvenilDebilitado,       critico: juvenilCritico },
  ADULTO:        { saudavel: adultoSaudavel,         debilitado: adultoDebilitado,         critico: adultoCritico },
  IDOSO:         { saudavel: idosoSaudavel,           debilitado: idosoDebilitado,           critico: idosoCritico },
};
