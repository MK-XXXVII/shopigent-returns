-- Add unique constraint on mcpApiKeyHash for efficient lookup
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_mcpApiKeyHash_key" UNIQUE ("mcpApiKeyHash");
