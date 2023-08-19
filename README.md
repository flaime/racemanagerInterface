# An application to extract data from racemanager

## How to find the "ID" of a competition:

Go to the competition page on racemanager, and look at the URL. It should look something like this:

```
https://racemanager.io/competitions/5e8b1b2b4f9b7c0001b2b4f9
```

Go to:
https://se.racemanager.net/en 

and find the competition you want to extract data from. Click on the competition, and look at the URL. It should look something like this:


```
https://se.racemanager.net/en/results/competition/324702/
```
Where you want to extract the competition ID, in this case: `324702` and then add it to the URL below like this:

```
https://se.racemanager.net/api/page/324702
```
Then you will get a Json "file" where the "name" is the ID of the competition. In this case: `marathon-sm-s-dert-lje-2023` 