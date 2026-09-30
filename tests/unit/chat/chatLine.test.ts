import { describe, expect, it } from 'vitest';
import { ChatReader, parseChatLine, parseCraftLine, type ChatEvent } from '../../../src/core/chat/chatLine';

/** Espace fine insécable : séparateur des milliers du client français. */
const NNBSP = ' ';

describe('parseChatLine', () => {
  it('objets ramassés et perdus, tels que les écrit le client français', () => {
    expect(parseChatLine('21:53:17,445 - [Information (jeu)] Vous avez ramassé 7x Serre de Kroapule .')).toEqual({
      locale: 'fr',
      name: 'Serre de Kroapule',
      qty: 7,
    });
    expect(parseChatLine('20:47:14,136 - [Information (jeu)] Vous avez perdu 30x Poudre .')).toEqual({
      locale: 'fr',
      name: 'Poudre',
      qty: -30,
    });
    // Points dans le nom, apostrophe.
    expect(parseChatLine('21:05:39,684 - [Information (jeu)] Vous avez perdu 2x J.A.R.N.O .')?.name).toBe('J.A.R.N.O');
    expect(parseChatLine("18:18:50,257 - [Information (jeu)] Vous avez ramassé 43x Croc de Yech'Ti'Wawa .")?.name).toBe(
      "Croc de Yech'Ti'Wawa",
    );
    expect(parseChatLine(`18:20:55,933 - [Information (jeu)] Vous avez perdu 1${NNBSP}420x Poudre .`)?.qty).toBe(-1420);
  });

  it('récolte, telle que l\'écrivent les clients anglais, espagnol et portugais', () => {
    expect(parseChatLine('22:58:42,572 - [Game Log] You have picked up 3x Radiant Edelweiss Flower .')).toEqual({
      locale: 'en',
      name: 'Radiant Edelweiss Flower',
      qty: 3,
    });
    expect(parseChatLine('23:03:33,074 - [Información (juego)] Has recogido 2x Flor de Edelweiss brillante .')).toEqual({
      locale: 'es',
      name: 'Flor de Edelweiss brillante',
      qty: 2,
    });
    expect(parseChatLine('23:05:18,951 - [Registro de Jogo] Você pegou 2x Edelvais .')).toEqual({
      locale: 'pt',
      name: 'Edelvais',
      qty: 2,
    });
    expect(parseChatLine('22:58:03,761 - [Game Log] You have just used: Cotton Seed')).toBeNull();
  });

  it('objets perdus en anglais, espagnol et portugais (item.selfDrop), séparateurs de milliers, sans espace avant le point', () => {
    expect(parseChatLine('10:00:00,000 - [Game Log] You have lost 1,200x Powder.')).toEqual({
      locale: 'en',
      name: 'Powder',
      qty: -1200,
    });
    expect(parseChatLine('10:00:00,000 - [Información (juego)] Has perdido 1.200x Polvo .')).toEqual({
      locale: 'es',
      name: 'Polvo',
      qty: -1200,
    });
    expect(parseChatLine('10:00:00,000 - [Registro de Jogo] Você perdeu 5x Fio Durável.')).toEqual({
      locale: 'pt',
      name: 'Fio Durável',
      qty: -5,
    });
  });

  it('ignore les autres lignes : kamas, combat, craft, ventes, messages de joueurs', () => {
    const ignored = [
      `21:04:28,178 - [Information (jeu)] Vous avez perdu 1${NNBSP}900 kamas.`,
      // Objet vendu à l'HDV : déjà retiré de l'inventaire à sa mise en vente (« perdu »).
      '23:05:06,489 - [Registro de Jogo] Você vendeu 1x Capacete de Krápula  por um total de 4.898§.',
      '21:53:20,910 - [Information (combat)] Vous avez ramassé 7x Serre de Kroapule .',
      '20:47:14,137 - [Information (jeu)] Vous avez réussi votre recette de Incantation de Féca Solide.',
      '20:46:27,801 - [Information (jeu)] Vous avez détruit 1 objet et récupéré 5 ressources',
      '16:00:00,000 - [Proximité] Joueur : Vous avez ramassé 99x Poudre .',
      '16:00:00,000 - [Privé] De Joueur : [Information (jeu)] Vous avez ramassé 99x Poudre .',
      'Vous avez ramassé 7x Serre de Kroapule .',
      '21:53:17,445 - [Information (jeu)] Vous avez ramassé 0x Poudre .',
      '21:53:17,445 - [Information (jeu)] Vous avez ramassé 7x  .',
      '',
    ];
    for (const line of ignored) expect(parseChatLine(line), line).toBeNull();
  });
});

describe('parseCraftLine', () => {
  it('craft réussi, tel que l\'écrit le client français, avec l\'heure de la ligne', () => {
    expect(parseCraftLine('22:16:42,500 - [Information (jeu)] Vous avez réussi votre recette de Lady Gladague.')).toEqual({
      locale: 'fr',
      name: 'Lady Gladague',
      time: ((22 * 60 + 16) * 60 + 42) * 1000 + 500,
    });
    expect(
      parseCraftLine("22:42:55,298 - [Information (jeu)] Vous avez réussi votre recette de Petit Atelier d'Herboriste.")?.name,
    ).toBe("Petit Atelier d'Herboriste");
  });

  it('textes du jeu en anglais, espagnol et portugais', () => {
    expect(parseCraftLine('10:00:00,000 - [Game Log] You have successfully completed the Larduous Hat recipe.')).toMatchObject({
      locale: 'en',
      name: 'Larduous Hat',
    });
    expect(
      parseCraftLine('10:00:00,000 - [Información (juego)] Has realizado con éxito la receta de Sombrero de Pan Z.'),
    ).toMatchObject({ locale: 'es', name: 'Sombrero de Pan Z' });
    expect(
      parseCraftLine('10:00:00,000 - [Registro de Jogo] Você completou a receita Chapéu Banhoso com sucesso.'),
    ).toMatchObject({ locale: 'pt', name: 'Chapéu Banhoso' });
  });

  it('ignore les autres lignes : objets, craft raté, autres canaux, messages de joueurs', () => {
    const ignored = [
      '22:16:42,499 - [Information (jeu)] Vous avez ramassé 1x Lady Gladague .',
      '22:16:42,500 - [Information (jeu)] Vous avez raté votre recette de Lady Gladague !',
      '22:16:42,500 - [Information (combat)] Vous avez réussi votre recette de Lady Gladague.',
      '16:00:00,000 - [Privé] De Joueur : [Information (jeu)] Vous avez réussi votre recette de Lady Gladague.',
      'Vous avez réussi votre recette de Lady Gladague.',
    ];
    for (const line of ignored) expect(parseCraftLine(line), line).toBeNull();
  });
});

describe('ChatReader', () => {
  const at = (time: string, text: string) => `${time} - [Information (jeu)] ${text}`;
  const read = (reader: ChatReader, lines: string[]) => lines.map((l) => reader.read(l)).filter((e): e is ChatEvent => !!e);
  const crafts = (events: ChatEvent[]) =>
    events.flatMap((e) => (e.kind === 'craft' ? [`${e.name} : ${e.items.map((i) => `${i.qty} ${i.name}`).join(', ')}`] : []));

  it('un craft : ses objets perdus et ramassés, annoncés un à un, puis joints au craft', () => {
    const events = read(new ChatReader(), [
      at('23:10:35,338', "Boulanger : +495 points d'XP.  Prochain niveau dans : 300."),
      at('23:10:35,339', 'Vous avez perdu 10x Chardon Couronné .'),
      at('23:10:35,339', "Vous avez perdu 10x Fleur d'Irisse ."),
      at('23:10:35,341', 'Vous avez ramassé 2x Huile Grossière .'),
      at('23:10:35,341', 'Vous avez réussi votre recette de Huile Grossière.'),
    ]);
    const items = [
      { locale: 'fr', name: 'Chardon Couronné', qty: -10 },
      { locale: 'fr', name: "Fleur d'Irisse", qty: -10 },
      { locale: 'fr', name: 'Huile Grossière', qty: 2 },
    ] as const;
    expect(events).toEqual([
      ...items.map((i) => ({ kind: 'item', ...i })),
      { kind: 'craft', locale: 'fr', name: 'Huile Grossière', items },
    ]);
  });

  it('seulement les lignes écrites juste avant : ni un objet ramassé plus tôt, ni celles du craft précédent', () => {
    const events = read(new ChatReader(), [
      at('23:09:09,991', 'Vous avez ramassé 1x Chardon Couronné .'),
      at('23:10:35,339', 'Vous avez perdu 10x Chardon Couronné .'),
      at('23:10:35,341', 'Vous avez ramassé 2x Huile Grossière .'),
      at('23:10:35,341', 'Vous avez réussi votre recette de Huile Grossière.'),
      at('23:10:35,500', 'Vous avez réussi votre recette de Huile Grossière.'),
      at('23:10:42,874', 'Vous avez perdu 5x Feuille de Menthe .'),
      at('23:10:42,874', 'Vous avez ramassé 1x Huile Rudimentaire .'),
      at('23:10:42,874', 'Vous avez réussi votre recette de Huile Rudimentaire.'),
    ]);
    expect(crafts(events)).toEqual([
      'Huile Grossière : -10 Chardon Couronné, 2 Huile Grossière',
      'Huile Grossière : ',
      'Huile Rudimentaire : -5 Feuille de Menthe, 1 Huile Rudimentaire',
    ]);
  });

  it('craft à cheval sur minuit', () => {
    const events = read(new ChatReader(), [
      at('23:59:59,900', 'Vous avez perdu 5x Fayot .'),
      at('00:00:00,050', 'Vous avez ramassé 1x Fibre Durable .'),
      at('00:00:00,050', 'Vous avez réussi votre recette de Fibre Durable.'),
    ]);
    expect(crafts(events)).toEqual(['Fibre Durable : -5 Fayot, 1 Fibre Durable']);
  });
});
