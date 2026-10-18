import type { Page } from "./contracts";
import type {
  DocumentDefinition,
  DocumentAdapter,
  DocumentArchive,
  DocumentSnapshot,
} from "./document";
// Private shared contract for the two fixed submission lifecycles.
export type SubmissionDefinition<
  D extends object,
  I,
  S,
  O,
  H,
  A extends object,
  E,
> = Omit<DocumentDefinition<D, I, S, O, H, A, E>, "adapter"> & {
  adapter: Omit<DocumentAdapter<D, I, S, O, H, A>, "query"> &
    Partial<Pick<DocumentAdapter<D, I, S, O, H, A>, "query">>;
  vouchers?: {
    list(input: {
      scope: string;
      page: number;
      pageSize: number;
    }): Promise<Page<{ identity: I; number: string; handler: string }>>;
    get(input: {
      scope: string;
      identity: I;
    }): Promise<DocumentArchive<D, I, S, O, H, A>>;
    empty?(input: { scope: string }): DocumentSnapshot<D, I, S, O, H>;
    canClone?(source: DocumentSnapshot<D, I, S, O, H>): boolean;
    clone?(input: {
      scope: string;
      source: DocumentSnapshot<D, I, S, O, H>;
    }): DocumentSnapshot<D, I, S, O, H>;
  };
};
