# seed

Development seed, not a feature. Loads the website's demo content (`src/data/demo-data.json`) into the database
with the `seed` profile:

    ./gradlew bootRun --args='--spring.profiles.active=dev,seed'

It is safe to repeat. It is never active in production, and no feature code uses it.
