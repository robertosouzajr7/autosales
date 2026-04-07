import fs from 'fs';
let c = fs.readFileSync('prisma/schema.prisma', 'utf8');

const sdrBotBlock = /model SdrBot \{([\s\S]*?)\}/;
if (sdrBotBlock.test(c)) {
    const blockContent = c.match(sdrBotBlock)[1];
    if (!blockContent.includes('icpProfiles')) {
        const newBlock = `model SdrBot {${blockContent}  icpProfiles        IcpProfile[]\n}`;
        c = c.replace(sdrBotBlock, newBlock);
    }
}

fs.writeFileSync('prisma/schema.prisma', c, 'utf8');
console.log('✅ SdrBot relation fixed');
