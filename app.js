var chalk = require('chalk'),
    fs = require('fs'),
    table = require('text-table');

// load the players database
var playerDB = JSON.parse(fs.readFileSync('player-data/players_2016-03-11.json', { 'encoding' : 'utf-8' })).players.player;

// Take the JSON from an MFL "draft" export and merge it with player data to get our desired object.
var convertPicks = function(exportedPickData) {

    return exportedPickData.reduce( function (currentList, draftPick) {

        // find the player drafted
        var discoveredPlayer = playerDB.filter ( function ( player ) {
            return player.id === draftPick.player;
        });

        // mock could be in progress, so make sure we found a matching player before adding.
        if (discoveredPlayer.length > 0) {

            // add the newly player player object
            currentList.push({
                "id" : draftPick.player,
                "name" : discoveredPlayer[0].name,
                "position" : discoveredPlayer[0].position,
                "team" : discoveredPlayer[0].team,
                "picks" : [ ( parseInt( draftPick.round ) - 1 ) * 12 + parseInt( draftPick.pick ) ]
            });
        }

        return currentList;

    }, []);
};

// Take a given filename containing an MFL "draft" export and run it through the conversion routine.
var readPicksFromFile = function(filename) {

    var picks = convertPicks(JSON.parse(fs.readFileSync(filename, { 'encoding' : 'utf-8' })).draftResults.draftUnit.draftPick);

    if (picks.length < 240) {
        console.log(chalk.bgRed("Warning : Found incomplete draft in", filename));
    }

    return picks;
};

// obtain the list of all files in our draft data directory.
var draftExportList = fs.readdirSync('draft-data');

// placeholder for final results.
var results = [];

// iterate each list of drafts.
for ( var listIndex in draftExportList ) {

    var draftExport = readPicksFromFile('draft-data/' + draftExportList[listIndex]);

    // take each draft and reduce it down to what we're actually looking for.
    results = draftExport.reduce( function ( previousResults, draftPick ) {

        // filter the existing list to see if this player was selected in previous draft.
        var existingPlayer = previousResults.filter ( function ( player ) {
            return player.id === draftPick.id;
        });

        // if we found him, add this selection to that entry.
        if (existingPlayer.length > 0) {
            //console.log("Found existing player : %j, %j", existingPlayer, draftPick);
            existingPlayer[0].picks.push(draftPick.picks[0]);
        }

        // otherwise, create a new entry for the player.
        else {
            //console.log("Pushing new player : %j", draftPick);
            previousResults.push(draftPick);
        }

        // return the array for use in next iteration
        return previousResults;

    }, results);
}

// calculate the ADP
var adpResults = results.map( function (player) {

    // get the total pick value for the entire array
    var total = player.picks.reduce( function ( total, number ) {
        return total + number;
    }, 0);

    player.adp = total / [player.picks.length];
    return player;
});

adpResults.sort( function(a, b) {
    return a.adp - b.adp;
});

// reformat the data for our table output library
var tabularAdp = adpResults.map( function (player, index) {

    var earliestPick = player.picks.reduce( function(a, b) {
        return Math.min(a,b)
    });

    var latestPick = player.picks.reduce( function(a, b) {
        return Math.max(a,b)
    });

    // text-table wants an array.
    return [
        index + 1,
        chalk.green(player.name),
        player.team,
        player.position,
        player.adp.toFixed(2),
        player.picks.length,
        earliestPick,
        latestPick,
        player.picks.toString()
    ];
});

// add the headers.  Silly text-table thing gets all wonky if the chalk formatting here doesn't match data.  PITA.
tabularAdp.unshift(['', chalk.green('Name'), 'Team', 'Pos', 'ADP', 'Times', 'First', 'Last', 'Picks']);

console.log("Found " + adpResults.length + " players");
console.log(table(tabularAdp.slice(0, 50)));
