// Perguntas do formulário. Os "value" são enviados à API; os "label" são
// gravados no Supabase para facilitar a leitura no painel.

export type QuestionId = 'estilo' | 'objetivo' | 'quantidade';

export type Question = {
  id: QuestionId;
  title: string;
  options: { value: string; label: string }[];
};

export const QUESTIONS: Question[] = [
  {
    id: 'estilo',
    title: 'Qual estilo de vídeo você procura?',
    options: [
      { value: 'falando', label: 'Vídeos em que eu apareço falando' },
      { value: 'motion', label: 'Vídeos totalmente em motion/animação' },
      { value: 'misto', label: 'Uma mistura dos dois' },
      { value: 'orientacao', label: 'Ainda não sei, preciso de orientação' },
    ],
  },
  {
    id: 'objetivo',
    title: 'Qual é o principal objetivo dos vídeos?',
    options: [
      { value: 'redes_sociais', label: 'Produzir conteúdo para redes sociais' },
      { value: 'anuncios', label: 'Criar anúncios e criativos' },
      { value: 'produtos_servicos', label: 'Apresentar meus produtos ou serviços' },
      { value: 'outro', label: 'Outro objetivo' },
    ],
  },
  {
    id: 'quantidade',
    title: 'Quantos vídeos você precisa?',
    options: [
      { value: '1_5', label: 'De 1 a 5 vídeos por mês' },
      { value: '6_15', label: 'De 6 a 15 vídeos por mês' },
      { value: '15_mais', label: 'Mais de 15 vídeos por mês' },
      { value: 'pontual', label: 'Apenas um projeto pontual' },
    ],
  },
];

export function labelFor(id: QuestionId, value: unknown): string | null {
  const q = QUESTIONS.find((q) => q.id === id);
  return q?.options.find((o) => o.value === value)?.label ?? null;
}
