
import * as wpTurbo from './wpTurbo';

export type AcademyTopicNode = {
  id?: string | number;
  title: string;
  children?: AcademyTopicNode[];
  content_pt?: string;
  content_en?: string;
  content_es?: string;
  displayTitle?: Record<string, string>;
  content?: Record<string, string>;
  parentId?: string | null;
  tier?: number;
};

/**
 * Busca tópicos tentando primeiro o JSON estático via wpTurbo
 */
export async function fetchAcademyTopics(): Promise<AcademyTopicNode[]> {
  try {
    const res = await wpTurbo.fetchAcademyTopics();
    return Array.isArray(res.items) ? res.items : [];
  } catch (e) {
    console.error("Academy Topics Error", e);
    return [];
  }
}

export async function saveAcademyTopics(topics: AcademyTopicNode[], password: string): Promise<any> {
  return wpTurbo.saveAcademyTopics({ topics, password });
}
