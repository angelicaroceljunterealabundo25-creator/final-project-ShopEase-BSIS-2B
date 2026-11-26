# Database

[The Mongoose model definitions](../backend/models.js) are the schema used by the current application. [The connection module](../backend/db.js) opens MongoDB Atlas and initializes the models and indexes. The data model uses MongoDB ObjectIds for document identity and stable public UUIDs for application relationships.

`psgc-locations.json` is bundled Philippine location data for the checkout dropdowns. `schema.sql` is retained for importing records from the earlier local PostgreSQL version. New installations use MongoDB.
