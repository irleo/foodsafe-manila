export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(
  query = {},
  { defaultLimit = DEFAULT_PAGE_SIZE, maxLimit = MAX_PAGE_SIZE } = {},
) {
  const page = positiveInteger(query.page, 1);
  const requestedLimit = positiveInteger(query.limit, defaultLimit);
  const limit = Math.min(requestedLimit, maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}
