import os, zipfile, struct, zlib
D = os.path.dirname(os.path.abspath(__file__))
os.makedirs(D, exist_ok=True)

# PDF simples com texto extraível
conteudo = b"BT /F1 12 Tf 20 150 Td (Horario de atendimento de segunda a sexta das 9h as 18h) Tj ET\nBT /F1 12 Tf 20 130 Td (Limpeza de pele custa 180 reais e dura 50 minutos) Tj ET"
objs = [
 b"<</Type/Catalog/Pages 2 0 R>>",
 b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
 b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
 b"<</Length %d>>stream\n" % len(conteudo) + conteudo + b"\nendstream",
 b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
]
saida = b"%PDF-1.4\n"
for i, o in enumerate(objs, 1):
    saida += b"%d 0 obj" % i + o + b"endobj\n"
saida += b"trailer<</Root 1 0 R/Size %d>>\n%%%%EOF" % (len(objs) + 1)
open(f"{D}/documento.pdf","wb").write(saida)

# DOCX mínimo válido
doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
 '<w:p><w:r><w:t>Politica de cancelamento: avisar com 24 horas de antecedencia.</w:t></w:r></w:p>'
 '<w:p><w:r><w:t>Formas de pagamento aceitas: pix, cartao e dinheiro.</w:t></w:r></w:p>'
 '</w:body></w:document>')
rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
 '</Relationships>')
ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
 '<Default Extension="xml" ContentType="application/xml"/>'
 '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
 '</Types>')
with zipfile.ZipFile(f"{D}/documento.docx","w",zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", ct)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", doc)

open(f"{D}/documento.txt","w",encoding="utf-8").write(
  "Endereco: Rua das Flores, 100.\nEstacionamento gratuito para clientes.\nAtendemos convenios.\n")
open(f"{D}/contatos.csv","w",encoding="utf-8").write(
  "nome,telefone\nPaula Ribeiro,11988887777\nBruno Lima,11977776666\n")

# PNG 2x2
def png():
    def bloco(tipo, dados):
        return struct.pack(">I", len(dados)) + tipo + dados + struct.pack(">I", zlib.crc32(tipo + dados) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)
    linhas = b"".join(b"\x00" + b"\xff\x00\x00" * 2 for _ in range(2))
    return b"\x89PNG\r\n\x1a\n" + bloco(b"IHDR", ihdr) + bloco(b"IDAT", zlib.compress(linhas)) + bloco(b"IEND", b"")
open(f"{D}/imagem.png","wb").write(png())

# Arquivo grande, para o teste de limite (25 MB + folga)
with open(f"{D}/grande.png","wb") as f:
    f.write(png())
    f.write(b"\0" * (26 * 1024 * 1024))

print("amostras:", sorted(os.listdir(D)))
