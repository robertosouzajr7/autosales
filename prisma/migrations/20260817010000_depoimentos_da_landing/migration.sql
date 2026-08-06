-- Depoimentos exibidos na landing, em JSON: [{ nome, papel, texto, nota }].
--
-- Guardados no banco em vez de escritos no código porque depoimento é fala de
-- cliente real: deixar um texto de exemplo no código acabaria publicado como
-- se fosse avaliação verdadeira. Nulo é o estado normal de uma conta nova.
ALTER TABLE "LandingPageSettings" ADD COLUMN "testimonials" TEXT;
