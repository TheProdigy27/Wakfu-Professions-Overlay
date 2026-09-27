import { describe, expect, it } from 'vitest';
import { parseChatLine } from '../../../src/core/chat/chatLine';

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
