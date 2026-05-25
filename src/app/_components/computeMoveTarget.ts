import { arrayMove } from "@dnd-kit/sortable";
import type { TodoBucket } from "@/lib/todos/types";

/** Issue #44 (B-3 drag): @dnd-kit drag end の (active, over) から、
 *  moveTodo に渡す (bucket, position) を計算する純粋関数。
 *
 *  flatItems は全 bucket を bucket 順 (morning → forenoon → afternoon → night) で
 *  連結した平坦な並び。各 row が {id, bucket} を持つ。
 *
 *  アルゴリズム:
 *    1. arrayMove で flat list の中で active を newIndex に移す (dnd-kit と同じ semantics)
 *    2. 新 list 内で active の直上 row の bucket を新 bucket とする
 *       (active が先頭の場合は直下 row の bucket)
 *    3. 新 list 内で active より前にある「新 bucket と一致する」row の数を newPosition とする
 *
 *  この方法だと bucket 跨ぎの drag (例: morning の最後を afternoon の先頭にドラッグ)
 *  も自然に処理できる。
 */
export function computeMoveTarget(
  flatItems: { id: string; bucket: TodoBucket }[],
  activeId: string,
  overId: string,
): { bucket: TodoBucket; position: number } | null {
  if (!activeId || !overId) return null;
  if (activeId === overId) return null;

  const oldIndex = flatItems.findIndex((t) => t.id === activeId);
  const newIndex = flatItems.findIndex((t) => t.id === overId);
  if (oldIndex === -1 || newIndex === -1) return null;

  const newOrder = arrayMove(flatItems, oldIndex, newIndex);
  const activeIdxNew = newOrder.findIndex((t) => t.id === activeId);
  if (activeIdxNew === -1) return null;

  let newBucket: TodoBucket;
  if (activeIdxNew === 0) {
    // 先頭にドロップ: 直下 row の bucket を採用 (= bucket の先頭になる)
    newBucket = newOrder[1]?.bucket ?? flatItems[oldIndex].bucket;
  } else {
    // 直上 row の bucket を採用 (= その bucket 内に挿入)
    newBucket = newOrder[activeIdxNew - 1].bucket;
  }

  let newPosition = 0;
  for (let i = 0; i < activeIdxNew; i++) {
    if (newOrder[i].bucket === newBucket) newPosition++;
  }

  return { bucket: newBucket, position: newPosition };
}
