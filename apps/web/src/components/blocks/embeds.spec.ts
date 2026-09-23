import { describe, expect, it } from 'vitest';
import { BASE_ALLOWED, isAllowedEmbed, toEmbedUrl } from './BlockRenderer';

/**
 * The block editor lets authors paste any URL, so the renderer is the boundary
 * that decides what is allowed to run inside an iframe on our origin.
 */
describe('lista blanca de dominios embebibles', () => {
  it('acepta los proveedores del catalogo', () => {
    expect(isAllowedEmbed('https://www.youtube.com/watch?v=abc123', BASE_ALLOWED)).toBe(true);
    expect(isAllowedEmbed('https://vimeo.com/123456', BASE_ALLOWED)).toBe(true);
    expect(isAllowedEmbed('https://view.genially.com/abc', BASE_ALLOWED)).toBe(true);
  });

  it('acepta un subdominio de un proveedor permitido', () => {
    expect(isAllowedEmbed('https://player.vimeo.com/video/123', BASE_ALLOWED)).toBe(true);
  });

  it('rechaza un dominio que no esta en la lista', () => {
    expect(isAllowedEmbed('https://sitio-malicioso.com/video', BASE_ALLOWED)).toBe(false);
  });

  it('rechaza un dominio que solo contiene el nombre permitido', () => {
    // youtube.com.atacante.net no es youtube.com.
    expect(isAllowedEmbed('https://youtube.com.atacante.net/x', BASE_ALLOWED)).toBe(false);
    expect(isAllowedEmbed('https://noyoutube.com/x', BASE_ALLOWED)).toBe(false);
  });

  it('rechaza un prefijo pegado al dominio permitido', () => {
    expect(isAllowedEmbed('https://evilvimeo.com/123', BASE_ALLOWED)).toBe(false);
  });

  it('rechaza una URL que no se puede analizar', () => {
    expect(isAllowedEmbed('no-es-una-url', BASE_ALLOWED)).toBe(false);
    expect(isAllowedEmbed('', BASE_ALLOWED)).toBe(false);
  });

  it('rechaza esquemas peligrosos aunque el host parezca valido', () => {
    expect(isAllowedEmbed('javascript:alert(1)', BASE_ALLOWED)).toBe(false);
    expect(isAllowedEmbed('data:text/html;base64,PHNjcmlwdD4=', BASE_ALLOWED)).toBe(false);
  });

  it('respeta una lista blanca reducida por la empresa', () => {
    expect(isAllowedEmbed('https://www.youtube.com/watch?v=abc', ['vimeo.com'])).toBe(false);
    expect(isAllowedEmbed('https://vimeo.com/1', ['vimeo.com'])).toBe(true);
  });

  it('una lista vacia no permite nada', () => {
    expect(isAllowedEmbed('https://www.youtube.com/watch?v=abc', [])).toBe(false);
  });
});

describe('conversion a URL embebible', () => {
  it('convierte un enlace de YouTube al dominio sin cookies', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123',
    );
  });

  it('convierte un enlace corto de YouTube', () => {
    expect(toEmbedUrl('https://youtu.be/abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123',
    );
  });

  it('convierte un enlace de Vimeo al reproductor', () => {
    expect(toEmbedUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
  });

  it('convierte un enlace compartido de Loom', () => {
    expect(toEmbedUrl('https://www.loom.com/share/abc123')).toBe(
      'https://www.loom.com/embed/abc123',
    );
  });

  it('deja intacto un proveedor que ya entrega URL embebible', () => {
    const url = 'https://view.genially.com/abc123';
    expect(toEmbedUrl(url)).toBe(url);
  });

  it('devuelve la entrada cuando no es una URL analizable', () => {
    expect(toEmbedUrl('no-es-una-url')).toBe('no-es-una-url');
  });
});
