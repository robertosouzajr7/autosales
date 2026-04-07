import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../../../shared/prisma/prisma.service';

@Injectable()
export class SdrService {
  private genAI: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateResponse(
    tenantId: string,
    phone: string,
    name: string,
    message: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { sdrs: { where: { active: true } } },
    });

    if (!tenant?.sdrs.length || !tenant.openAiKey) return null;
    const sdr = tenant.sdrs[0];

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chat = model.startChat({
        history: [], // Fetch history here if needed
        generationConfig: { maxOutputTokens: 1000 },
    });

    const prompt = `Você é ${sdr.name}. ${sdr.prompt}. Tom de voz: ${sdr.voiceTone}. 
                   Lead: ${name} (${phone}). 
                   Conhecimento Base: ${sdr.knowledgeBase}`;
                   
    const result = await chat.sendMessage([
      { text: prompt }, 
      { text: message }
    ]);
    
    return result.response.text();
  }
}
