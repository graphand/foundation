/// <reference lib="deno.ns" />

Deno.serve(async req => {
  let json = "";
  try {
    json = await req.json();
  } catch (e) {}
  console.log(JSON.stringify(json));
  return new Response(JSON.stringify({ data: json || {} }));
});
