import type { Page } from "./contracts";
import type {
  VersionDefinition,
  VersionAdapter,
  VersionArchive,
  VersionSnapshot,
} from "./version";
// Private shared contract for the two fixed submission lifecycles.
export type SubmissionDefinition<
  D extends object,
  I,
  S,
  O,
  H,
  A extends object,
  E,
> = Omit<VersionDefinition<D, I, S, O, H, A, E>, "adapter"> & {
  adapter: Omit<VersionAdapter<D, I, S, O, H, A>, "query"> &
    Partial<Pick<VersionAdapter<D, I, S, O, H, A>, "query">>;
  documents?: {
    list(input: {
      scope: string;
      page: number;
      pageSize: number;
    }): Promise<Page<{ identity: I; number: string; handler: string }>>;
    get(input: {
      scope: string;
      identity: I;
    }): Promise<VersionArchive<D, I, S, O, H, A>>;
    empty?(input: { scope: string }): VersionSnapshot<D, I, S, O, H>;
    canClone?(source: VersionSnapshot<D, I, S, O, H>): boolean;
    clone?(input: {
      scope: string;
      source: VersionSnapshot<D, I, S, O, H>;
    }): VersionSnapshot<D, I, S, O, H>;
  };
};
