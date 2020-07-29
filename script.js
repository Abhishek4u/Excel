const $ = require("jquery");
const fs = require("fs");
const dialog = require("electron").remote.dialog;

$(document).ready(function () {
    let db; // database
    let lsc; // last selected cell
    let lastOne = {
        rowId: 0,
        colId: 0
    };
    $("#grid .cell").click(function () {

        let rid = Number($(this).attr("rid")) + 1;
        let cid = Number($(this).attr("cid")) + 65; // ascii to int conversion

        let address = String.fromCharCode(cid) + rid;

        $("#address-input").val(address);

        let { rowId, colId } = getRowColFromAddr(address);
        const cellObject = db[rowId][colId];

        $("#formula-input").val(cellObject.formula);

        // for highlighting col and row
        changeLeftAndTopColor(lastOne.rowId, lastOne.colId, "aquamarine");
        changeLeftAndTopColor(rowId, colId, "#4EDAAB");
        lastOne = {
            rowId: rowId,
            colId: colId
        }

    })

    $("#grid .cell").keyup(function () {
        let height = $(this).height();

        let rowId = $(this).attr("rid");
        let lCArr = $("#left-col .cell");
        let myCol = lCArr[rowId];

        $(myCol).css("height", height + 2);
    })

    $("#cell-container").on("scroll", function () {
        let vertScroll = $(this).scrollTop();
        let horiScroll = $(this).scrollLeft();

        $("#topleft-cell").css({
            "top": vertScroll,
            "left": horiScroll
        });

        $("#left-col").css("left", horiScroll);

        $("#top-row").css("top", vertScroll);
    })

    $(".menu").on("click", function () {
        let optionName = $(this).attr("id");

        $(".menu-options").removeClass("active");
        $(`#${optionName}-menu-options`).addClass("active");

        $(".menu").removeClass("menu-active");
        $(`#${optionName}`).addClass("menu-active");
    })

    // **************************NEW OPEN SAVE**************************

    $("#new").click(function () {
        // initialize the database
        db = [];
        let allRows = $("#grid").find(".row");

        for (let i = 0; i < allRows.length; i++) {

            let cells = $(allRows[i]).find(".cell");
            let row = [];

            for (let j = 0; j < cells.length; j++) {

                $(cells[j]).html("");
                let cell = {
                    value: "",
                    formula: "",
                    children: [],
                    parents: [],
                    bold: false,
                    underline: false,
                    italic: false
                };
                row.push(cell);
            }
            db.push(row);

            // For left column height
            changeHeightOfLeftCol(i, 0);
        }
        // initial click
        let allCells = $("#grid .cell");
        $(allCells[0]).trigger("click");
    })

    $("#open").click(async function () {
        let sdb = await dialog.showOpenDialog();
        let buffer = fs.readFileSync(sdb.filePaths[0]);

        db = JSON.parse(buffer);

        let allRows = $("#grid").find(".row");
        for (let i = 0; i < allRows.length; i++) {

            let cells = $(allRows[i]).find(".cell");
            for (let j = 0; j < cells.length; j++) {
                $(cells[j]).html(db[i][j].value);
            }
        }
    })

    $("#save").click(function () {
        let sdb = dialog.showSaveDialogSync();
        let strData = JSON.stringify(db);

        fs.writeFileSync(sdb, strData);
        console.log("File Saved");
    })


    // ************************FORMULA*************************
    // update
    // val=> val 
    // val => formula
    $("#grid .cell").blur(function () {
        let rowId = $(this).attr("rid");
        let colId = $(this).attr("cid");

        let cellObject = db[rowId][colId];

        if (cellObject.value == $(this).html()) {
            return;

        }
        if (cellObject.formula) {
            removeFormula(cellObject, rowId, colId);
        }

        let value = $(this).html();
        updateCell(rowId, colId, value);
        // console.log("Cells");
        // console.log(db);
    })

    // val=> formula
    // formula => formula
    $("#formula-input").blur(function () {
        let formula = $(this).val();

        let cellAddress = $("#address-input").val();
        let { rowId, colId } = getRowColFromAddr(cellAddress);
        let cellObject = db[rowId][colId];

        if (cellObject.formula == $(this).val()) {
            return;
        }

        // if (checkFormula(cellObject,formula) == false) {
        //     alert("Formula is invalid !");
        //     return;
        // }

        if (cellObject.formula) {
            removeFormula(cellObject, rowId, colId);
        }

        let ans = evaluate(formula);
        cellObject.formula = formula;
        setUpFormula(rowId, colId, formula, cellObject);
        updateCell(rowId, colId, ans);

    })


    function removeFormula(cellObject, rowId, colId) {

        for (let i = 0; i < cellObject.parents.length; i++) {

            let parentRowCol = cellObject.parents[i];
            let parentObj = db[parentRowCol.rowId][parentRowCol.colId];

            let idx = parentObj.children.findIndex(function (elementRowCol) {
                return (rowId == elementRowCol.rowId && colId == elementRowCol.colId);
            })

            parentObj.children.splice(idx, 1);
        }

        cellObject.parents = [];
        cellObject.formula = "";
    }

    function updateCell(rowId, colId, ans) {

        // Recursive function to update values

        $(`#grid .cell[rid=${rowId}][cid=${colId}]`).html(ans);

        changeHeightOfLeftCol(rowId, colId);

        let cellObject = db[rowId][colId];
        cellObject.value = ans;

        for (let i = 0; i < cellObject.children.length; i++) {
            let childRowCol = cellObject.children[i];
            let childObj = db[childRowCol.rowId][childRowCol.colId];
            let childAns = evaluate(childObj.formula);
            updateCell(childRowCol.rowId, childRowCol.colId, childAns);
        }
    }

    function evaluate(formula) {

        formula = formula.replace(/\s+/g, " ").trim();
        // extra space removal

        let fComp = formula.split(" ");
        // array of formula

        for (let i = 0; i < fComp.length; i++) {
            let ascii = fComp[i].charCodeAt(0);
            if (ascii >= 65 && ascii <= 90) {

                let { rowId, colId } = getRowColFromAddr(fComp[i]);

                let value = db[rowId][colId].value;
                formula = formula.replace(fComp[i], value);

            }
        }

        let ans = eval(formula);
        return ans;
    }

    function setUpFormula(cRowId, cColId, formula, cellObject) {

        formula = formula.replace(/\s+/g, " ").trim();
        // extra space removal

        let fComp = formula.split(" ");
        // array of formula

        for (let i = 0; i < fComp.length; i++) {
            let ascii = fComp[i].charCodeAt(0);
            if (ascii >= 65 && ascii <= 90) {

                let { rowId, colId } = getRowColFromAddr(fComp[i]);

                let parentObj = db[rowId][colId];
                parentObj.children.push({
                    rowId: cRowId,
                    colId: cColId
                })

                cellObject.parents.push({
                    rowId: rowId,
                    colId: colId
                })
            }
        }

    }

    function getRowColFromAddr(cellAddress) {

        let ascii = cellAddress.charCodeAt(0);
        let colId = ascii - 65;
        let rowId = Number(cellAddress.substring(1)) - 1;

        return {
            rowId: rowId,
            colId: colId
        }
    }

    function changeHeightOfLeftCol(rowId, colId) {

        // heigth of left cell 
        let heightElt = $(`#grid .cell[rid=${rowId}][cid=${colId}]`);
        let height = heightElt.height();
        let lCArr = $("#left-col .cell");
        let currentLCArr = lCArr[rowId];
        $(currentLCArr).css("height", height + 2);

    }

    function changeLeftAndTopColor(rowId, colId, color) {

        let topRow = $("#top-row .cell");
        let topRowCurrentCell = $(topRow)[colId];
        $(topRowCurrentCell).css({ "backgroundColor": color });

        let leftCol = $("#left-col .cell");
        let leftColCurrentCell = $(leftCol)[rowId];
        $(leftColCurrentCell).css({ "backgroundColor": color });
    }

    function checkFormula(cellObject, formula) {

    }

    $("#background-color").click(function () {
        $("#b-color").trigger("click");

    })

    $("#font-color").click(function () {

        $("#f-color").trigger("click");

    });


function init() {
    $("#File").trigger("click");
    $("#new").trigger("click");
}

init();
})