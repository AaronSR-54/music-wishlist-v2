export default async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), 100)
    : 100;

  try {
    const url = `https://api.deezer.com/artist/${id}/albums?limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Deezer request failed: ${response.status}` });
    }

    const data = await response.json();

    if (data?.error) {
      return res
        .status(data.error.code ?? 502)
        .json({ error: data.error.message ?? 'Deezer error' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
