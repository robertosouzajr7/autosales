import * as React from 'react';
export interface BotOProps {
  className?: string;
  style?: React.CSSProperties;
  estilo?: "primária" | "secundária" | "fantasma";
  estado?: "padrão" | "desabilitado";
  /** Text content; defaults to "Fazer recarga". */
  text1?: string;
}
export declare const BotO: React.FC<BotOProps>;
export default BotO;
