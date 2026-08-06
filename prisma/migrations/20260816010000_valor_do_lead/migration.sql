-- Valor da oportunidade por contato, em reais.
--
-- Sem ele o funil só sabe contar contatos: não há como somar "em negociação"
-- nem calcular ticket médio. Fica anulável porque nem todo negócio trabalha
-- com valor por contato, e forçar 0 faria o painel afirmar "R$ 0 fechados"
-- para quem simplesmente não preenche o campo.
ALTER TABLE "Lead" ADD COLUMN "value" DOUBLE PRECISION;
