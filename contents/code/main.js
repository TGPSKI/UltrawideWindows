function newSlotPosition(workspace, client, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill) {
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);

    var newX = maxArea.x + Math.round(maxArea.width / numberXslots * x);
    var newY = maxArea.y + Math.round(maxArea.height / numberYslots * y);

    // Width and height is calculated by finding where the window should end and subtracting where it should start
    var clientWidth = Math.round(maxArea.width / numberXslots * (x + xSlotToFill)) - (newX - maxArea.x);
    var clientHeight = Math.round(maxArea.height / numberYslots * (y + ySlotToFill)) - (newY - maxArea.y);

    return [newX, newY, clientWidth, clientHeight]
}

function reposition(client, newX, newY, w, h) {
    client.frameGeometry = {
        x: newX,
        y: newY,
        width: w,
        height: h
    }
}

function move(workspace, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill) {
    var client = workspace.activeWindow;
    if (client.moveable && client.resizeable) {
        client.setMaximize(false,false);
        arr = newSlotPosition(workspace, client, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill);
        var newX = arr[0],
            newY = arr[1],
            w = arr[2],
            h = arr[3];
        reposition(client, newX, newY, w, h)
    }
}

function center(workspace) {
    var client = workspace.activeWindow;
    if (client.moveable) {
        var maxArea = workspace.clientArea(KWin.MaximizeArea, client);
        var newX = Math.round(maxArea.x + ((maxArea.width - client.width) / 2));
        var newY = Math.round(maxArea.y + ((maxArea.height - client.height) / 2));
        reposition(client, newX, newY, client.width, client.height)
    }
}

function ensureWithinVisibleArea(client, new_w, new_h, old_w, old_h, old_x, old_y) {
    var new_x, new_y;
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);
    var ratio = new_w / new_h;

    var diff_x = old_w - new_w,
        diff_y = old_h - new_h;

    // Calculate a new x and y that will keep the position
    // of the window centered with respect to its previous
    // position
    new_x = old_x + Math.round(diff_x / 2);
    new_y = old_y + Math.round(diff_y / 2);

    // Ensure the newly calculate position is within the boundaries
    // of the visible desktop area
    if (new_y + new_h > maxArea.bottom) {
        new_y = new_y - ((new_y + new_h) - maxArea.bottom);
    }
    if (new_x + new_w > maxArea.right) {
        new_x = new_x - ((new_x + new_w) - maxArea.right);
    }

    // Also ensure that new_x and new_y is never less than 0
    new_x = new_x < 0 ? 0 : new_x;
    new_y = new_y < 0 ? 0 : new_y;

    return {"x": new_x, "y": new_y, "w": new_w, "h": new_h};
}

function calcShrink(client, decStepPx, minSizePx) {
    var geom = client.frameGeometry;
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);

    var ratio = geom.width / geom.height;
    var new_w, new_h;
    var new_xywh = {"x": geom.x, "y": geom.y, "w": geom.width, "h": geom.height};

    // Ensure the minSizePx is smaller than maxArea width/height
    minSizePx = minSizePx > maxArea.width ? maxArea.width : minSizePx;
    minSizePx = minSizePx > maxArea.height ? maxArea.height : minSizePx;

    if (client.moveable && client.resizeable) {
        if (ratio >= 1) {
            // Width >= Height
            new_w = geom.width - decStepPx;
            new_w = new_w < minSizePx ? minSizePx : new_w;
            new_h = Math.round(new_w / ratio);

            if (new_h > maxArea.height) {
                new_h = maxArea.height
                new_w = Math.round(new_h * ratio);
            }
        } else {
            // Height > Width
            new_h = geom.height - decStepPx;
            new_h = new_h < minSizePx ? minSizePx : new_h;
            new_w = Math.round(new_h * ratio);

            if (new_w > maxArea.width) {
                new_w = maxArea.width
                new_h = Math.round(new_w / ratio);
            }
        }

        new_xywh = ensureWithinVisibleArea(client, new_w, new_h, geom.width, geom.height, geom.x, geom.y)
    }

    return {"x": new_xywh.x, "y": new_xywh.y, "w": new_xywh.w, "h": new_xywh.h};
}

function calcGrow(client, incStepPx) {
    var geom = client.frameGeometry;
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);

    var ratio = geom.width / geom.height;
    var new_w, new_h;
    var new_xywh = {"x": geom.x, "y": geom.y, "w": geom.width, "h": geom.height};

    if (client.moveable && client.resizeable) {
        if (ratio >= 1) {
            // Width >= Height
            new_w = geom.width + incStepPx;
            new_w = new_w > maxArea.width ? maxArea.width : new_w;
            new_h = Math.round(new_w / ratio);

            if (new_h > maxArea.height) {
                new_h = maxArea.height
                new_w = Math.round(new_h * ratio);
            }
        } else {
            // Height > Width
            new_h = geom.height + incStepPx;
            new_h = new_h > maxArea.height ? maxArea.height : new_h;
            new_w = Math.round(new_h * ratio);

            if (new_w > maxArea.width) {
                new_w = maxArea.width
                new_h = Math.round(new_w / ratio);
            }
        }

        new_xywh = ensureWithinVisibleArea(client, new_w, new_h, geom.width, geom.height, geom.x, geom.y)
    }

    return {"x": new_xywh.x, "y": new_xywh.y, "w": new_xywh.w, "h": new_xywh.h};
}

function resize(workspace, action, incStepPx, minSizePx) {
    var client = workspace.activeWindow;

    if (client.moveable && client.resizeable) {
        var newGeom;

        if (action == "shrink") {
            newGeom =  calcShrink(client, incStepPx, minSizePx);
        } else if (action == "grow") {
            newGeom = calcGrow(client, incStepPx);
        } else {
            print("Please choose an action between 'shrink' and 'grow'");
            return;
        }

        // print(client.resourceName, JSON.stringify(newGeom));

        reposition(client, newGeom.x, newGeom.y, newGeom.w, newGeom.h);
    }
}

function moveWithFixedSize(workspace, moveDirection, movePx) {
    var client = workspace.activeWindow;
    var geom = client.frameGeometry;
    var x = geom.x,
        y = geom.y;
    if (client.moveable) {
        if (moveDirection == "left") {
            x = geom.x - movePx;
        } else if (moveDirection == "right") {
            x = geom.x + movePx;
        } else if (moveDirection == "up") {
            y = geom.y - movePx;
        } else if (moveDirection == "down") {
            y = geom.y + movePx;
        } else {
            print("Please choose a move direction between 'left', 'right', 'up' and 'down'");
            return;
        }
        new_xy = ensureWithinVisibleArea(client, geom.width, geom.height, geom.width, geom.height, x, y);
        reposition(client, new_xy.x, new_xy.y, geom.width, geom.height);
    }
}

// function isInPosition(workspace, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill) {
//     var client = workspace.activeWindow;
//     if (client.moveable) {
//         arr = getPosition(workspace, client, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill);
//         var newX = arr[0],
//             newY = arr[1],
//             w = arr[2],
//             h = arr[3];
//         return (client.x == newX && client.y == newY && client.width == w && client.height == h);
//     }
//     return false;
// }

// TGPSKI EDITS
const debug = true; // Set to false to turn off console.log output
const minVertHeight = 20;

function logDebug(...args) {
    if (debug) {
        console.log(...args);
    }
}

function expandObject(input) {
    return JSON.stringify(input, null, 4)
}

function findClientVerticalPositionInContainer(clients, containerGeometry, limits, vertMargin) {
    logDebug("findClientVerticalPositionInContainer");
    const newClientContainerPos = {
        x: containerGeometry.x,
        y: containerGeometry.y,
        width: limits.width,
        height: limits.height,
        minHeight: limits.minHeight
    };
    logDebug(expandObject(newClientContainerPos));
    logDebug("Update clientContainerPos in loop")
    clients.forEach(client => {
        newClientContainerPos.y += (client.height+vertMargin);
        newClientContainerPos.height -= (client.height+vertMargin);
        logDebug(`client height ${client.height}`);
        logDebug(`new container pos y ${newClientContainerPos.y}`);
    });

    if (newClientContainerPos.y >= limits.height || newClientContainerPos.y < minVertHeight ) {
        logDebug("newClientContainer outOfBounds")
        return { x: -1, y: -1, width: -1, height: -1 };
    }

    return newClientContainerPos;
}

function moveToColumn(workspace, colWidths, colPositions, vertMargin, colIndex, utilityContainerSeparatorWidth) {
    const activeClient = workspace.activeWindow; // More reliable than activeWindow
    if (!activeClient || !activeClient.moveable || !activeClient.resizeable) {
        console.warn("Active client is either not moveable or resizeable.");
        return;
    }

    activeClient.setMaximize(false, false);

    const maxArea = workspace.clientArea(KWin.MaximizeArea, workspace.activeScreen, workspace.currentDesktop);
    const limits = {
        width: colWidths[colIndex],
        height: maxArea.height - (2 * vertMargin),
        minHeight: minVertHeight
    };

    logDebug(`Moving client to column: ${colIndex}`);
    logDebug(`Column limits - Width: ${limits.width}, Height: ${limits.height}`);

    if (colIndex === 2) {
        // Right column container logic
        const containerGeometry = {
            x: colPositions[colIndex],
            y: maxArea.y + vertMargin,
            width: limits.width,
            height: limits.height
        };

        const allWindows = workspace.windowAt({
            x: containerGeometry.x,
            y: containerGeometry.y}, -1); // -1 to get all windows at this position
        logDebug(allWindows)

        const realWindows = allWindows.filter(window => !window.desktopWindow);
        logDebug(realWindows);

        if (realWindows.length && realWindows.includes(activeClient)) {
            logDebug("Self-reference detected, skipping reposition.");
            return;
        }

        var newClientContainerPos = findClientVerticalPositionInContainer(realWindows, containerGeometry, limits, utilityContainerSeparatorWidth, 20);
        logDebug("New client container position:", expandObject(newClientContainerPos));

        if (newClientContainerPos.y === -1) {
            console.warn("Not enough space in the container for the new window.");
            return;
        }

        reposition(activeClient, newClientContainerPos.x, newClientContainerPos.y, newClientContainerPos.width, newClientContainerPos.height);
        return;
    }

    // Default behavior for left and center columns
    const newX = maxArea.x + colPositions[colIndex];
    const newY = maxArea.y + vertMargin;

    if (colIndex < 0 || colIndex >= colWidths.length) {
        throw new Error("Invalid column index.");
    }

    reposition(activeClient, newX, newY, limits.width, limits.height);
}

function convertPercentagesToPixels(totalWidth, colPercentages) {
    return colPercentages.map(percent => Math.round(totalWidth * (percent / 100)));
}

function validateColumnWidths(colWidths, horizMargin, maxWidth) {
    let totalWidth = colWidths.reduce((sum, width) => sum + width, 0) + (colWidths.length + 1) * horizMargin;

    if (totalWidth > maxWidth) {
        throw new Error("Column widths plus margins exceed the available screen width.");
    }

    if (totalWidth < maxWidth) {
        const remainingWidth = maxWidth - totalWidth;
        colWidths[0] += Math.round(remainingWidth / 2);
        colWidths[1] += Math.round(remainingWidth / 2);
    }

    return colWidths;
}

function calculateColumnPositions(colWidths, horizMargin) {
    const positions = [];
    let currentPosition = horizMargin;

    colWidths.forEach(width => {
        positions.push(currentPosition);
        currentPosition += width + horizMargin;
    });

    return positions;
}

function applyColumnTakeover(workspace, horizMargin, vertMargin, colPercentages) {
    logDebug("applyColumnTakeover");
    const maxArea = workspace.clientArea(KWin.MaximizeArea, workspace.activeScreen, workspace.currentDesktop);
    const colWidths = convertPercentagesToPixels(maxArea.width - 4 * horizMargin, colPercentages);
    const adjustedColWidths = validateColumnWidths(colWidths, horizMargin, maxArea.width);
    const colPositions = calculateColumnPositions(adjustedColWidths, horizMargin);

    const activeClient = workspace.activeWindow;
    if (!activeClient || !activeClient.moveable || !activeClient.resizeable) {
        logDebug("Active client is either not moveable or resizeable.");
        return;
    }

    activeClient.setMaximize(false, false);


    const currentX = activeClient.frameGeometry.x;
    let takeoverWidth;
    let newX;

    logDebug(`x: ${currentX} colPos compare: ${colPositions[2]} `)

    if (currentX < colPositions[2]) {
        newX = colPositions[0];
        takeoverWidth = adjustedColWidths[0] + adjustedColWidths[1] + horizMargin;
        logDebug(takeoverWidth);
    }

    reposition(activeClient, newX, maxArea.y + vertMargin, takeoverWidth, maxArea.height - 2 * vertMargin);
}

function moveToThreeColumnLayoutWithPercentages(workspace, horizMargin = 25, vertMargin = 25, utilityContainerSeparatorWidth = 10, colPercentages = [29, 57, 12], ) {
    const maxArea = workspace.clientArea(KWin.MaximizeArea, workspace.activeScreen, workspace.currentDesktop);
    const totalWidth = maxArea.width - 4 * horizMargin;

    const colWidths = convertPercentagesToPixels(totalWidth, colPercentages);
    const adjustedColWidths = validateColumnWidths(colWidths, horizMargin, maxArea.width);
    const colPositions = calculateColumnPositions(adjustedColWidths, horizMargin);

    return function (colIndex) {
        if (colIndex < 0 || colIndex >= colWidths.length) {
            console.error("Invalid column index.");
            return;
        }
        moveToColumn(workspace, adjustedColWidths, colPositions, vertMargin, colIndex, utilityContainerSeparatorWidth);
    };
}

const layoutConfig = {
    horizMargin: 50,
    vertMargin: 50,
    colPercentages: [29, 57, 12],
    utilityContainerSeparatorWidth: 30,
};


registerShortcut("MoveWindowToLeftColumnWithPercent", "UltrawideWindows: Move Window to Left Column with Percentages", "Meta+Ctrl+Alt+D", function () {
    var moveToColumnFn = moveToThreeColumnLayoutWithPercentages(
        workspace,
        layoutConfig.horizMargin,
        layoutConfig.vertMargin,
        layoutConfig.utilityContainerSeparatorWidth,
        layoutConfig.colPercentages
    );
    moveToColumnFn(0);
});

registerShortcut("MoveWindowToCenterColumnWithPercent", "UltrawideWindows: Move Window to Center Column with Percentages", "Meta+Ctrl+Alt+B", function () {
    var moveToColumnFn = moveToThreeColumnLayoutWithPercentages(
        workspace,
        layoutConfig.horizMargin,
        layoutConfig.vertMargin,
        layoutConfig.utilityContainerSeparatorWidth,
        layoutConfig.colPercentages
    );
    moveToColumnFn(1);
});

registerShortcut("MoveWindowToRightColumnWithPercent", "UltrawideWindows: Move Window to Right Column with Percentages", "Meta+Ctrl+Alt+H", function () {
    var moveToColumnFn = moveToThreeColumnLayoutWithPercentages(
        workspace,
        layoutConfig.horizMargin,
        layoutConfig.vertMargin,
        layoutConfig.utilityContainerSeparatorWidth,
        layoutConfig.colPercentages
    );
    moveToColumnFn(2);
});

registerShortcut("ApplyWindowTakeoverWithPercent", "UltrawideWindows: Apply Window Takeover", "Meta+Ctrl+Alt+V", function () {
    applyColumnTakeover(
        workspace,
        layoutConfig.horizMargin,
        layoutConfig.vertMargin,
        layoutConfig.colPercentages
    );
});


// END TGPSKI EDITS
// GRID 3x2
registerShortcut("MoveWindowToUpLeft3x2", "UltrawideWindows: Move Window to up-left (3x2)", "Meta+Num+7", function () {
    move(workspace, 3, 2, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToUpCenter3x2", "UltrawideWindows: Move Window to up-center (3x2)", "Meta+Num+8", function () {
    move(workspace, 3, 2, 1, 0, 1, 1)
});

registerShortcut("MoveWindowToUpRight3x2", "UltrawideWindows: Move Window to up-right (3x2)", "Meta+Num+9", function () {
    move(workspace, 3, 2, 2, 0, 1, 1)
});

registerShortcut("MoveWindowToDownLeft3x2", "UltrawideWindows: Move Window to down-left (3x2)", "Meta+Num+1", function () {
    move(workspace, 3, 2, 0, 1, 1, 1)
});

registerShortcut("MoveWindowToDownCenter3x2", "UltrawideWindows: Move Window to down-center (3x2)", "Meta+Num+2", function () {
    move(workspace, 3, 2, 1, 1, 1, 1)
});

registerShortcut("MoveWindowToDownRight3x2", "UltrawideWindows: Move Window to down-right (3x2)", "Meta+Num+3", function () {
    move(workspace, 3, 2, 2, 1, 1, 1)
});

registerShortcut("MoveWindowToLeftHeight3x2", "UltrawideWindows: Move Window to left-height (3x2)", "Meta+Num+4", function () {
    move(workspace, 3, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToCenterHeight3x2", "UltrawideWindows: Move Window to center-height (3x2)", "Meta+Num+5", function () {
    move(workspace, 3, 1, 1, 0, 1, 1)
});

registerShortcut("MoveWindowToRightHeight3x2", "UltrawideWindows: Move Window to right-height (3x2)", "Meta+Num+6", function () {
    move(workspace, 3, 1, 2, 0, 1, 1)
});

// GRID 2x2

registerShortcut("MoveWindowToUpLeft2x2", "UltrawideWindows: Move Window to up-left (2x2)", "ctrl+Num+7", function () {
    move(workspace, 2, 2, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToUpCenter2x2", "UltrawideWindows: Move Window to up-width (2x2)", "ctrl+Num+8", function () {
    move(workspace, 1, 2, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToUpRight2x2", "UltrawideWindows: Move Window to up-right (2x2)", "ctrl+Num+9", function () {
    move(workspace, 2, 2, 1, 0, 1, 1)
});

registerShortcut("MoveWindowToDownLeft2x2", "UltrawideWindows: Move Window to down-left (2x2)", "ctrl+Num+1", function () {
    move(workspace, 2, 2, 0, 1, 1, 1)
});

registerShortcut("MoveWindowToDownCenter2x2", "UltrawideWindows: Move Window to down-width (2x2)", "ctrl+Num+2", function () {
    move(workspace, 1, 2, 0, 1, 1, 1)
});

registerShortcut("MoveWindowToDownRight2x2", "UltrawideWindows: Move Window to down-right (2x2)", "ctrl+Num+3", function () {
    move(workspace, 2, 2, 1, 1, 1, 1)
});

registerShortcut("MoveWindowToLeftHeight2x2", "UltrawideWindows: Move Window to left-height (2x2)", "ctrl+Num+4", function () {
    move(workspace, 2, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToRightHeight2x2", "UltrawideWindows: Move Window to right-height (2x2)", "ctrl+Num+6", function () {
    move(workspace, 2, 1, 1, 0, 1, 1)
});


// GRID 4x2 center biased (lateral windows fit accordingly to ctrl-X shortcuts)
registerShortcut("MoveWindowToUpLeft4x2_centerbiased", "UltrawideWindows: Move Window to up-left (4x2 center biased)", "Ctrl+Meta+Num+7", function () {
    move(workspace, 4, 2, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToUpCenter4x2_centerbiased", "UltrawideWindows: Move Window to up-center (4x2 center biased)", "Ctrl+Meta+Num+8", function () {
    move(workspace, 4, 2, 1, 0, 2, 1)
});

registerShortcut("MoveWindowToUpRight4x2_centerbiased", "UltrawideWindows: Move Window to up-right (4x2 center biased)", "Ctrl+Meta+Num+9", function () {
    move(workspace, 4, 2, 3, 0, 1, 1)
});

registerShortcut("MoveWindowToDownLeft4x2_centerbiased", "UltrawideWindows: Move Window to down-left (4x2 center biased)", "Ctrl+Meta+Num+1", function () {
    move(workspace, 4, 2, 0, 1, 1, 1)
});

registerShortcut("MoveWindowToDownCenter4x2_centerbiased", "UltrawideWindows: Move Window to down-center (4x2 center biased)", "Ctrl+Meta+Num+2", function () {
    move(workspace, 4, 2, 1, 1, 2, 1)
});

registerShortcut("MoveWindowToDownRight4x2_centerbiased", "UltrawideWindows: Move Window to down-right (4x2 center biased)", "Ctrl+Meta+Num+3", function () {
    move(workspace, 4, 2, 3, 1, 1, 1)
});

registerShortcut("MoveWindowToLeftHeight4x2_centerbiased", "UltrawideWindows: Move Window to left-height (4x2 center biased)", "Ctrl+Meta+Num+4", function () {
    move(workspace, 4, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToCenterLeftHeight4x2_centerbiased", "UltrawideWindows: Move Window to center-left-height (4x2 center biased)", "Ctrl+Meta+Shift+Num+4", function () {
    move(workspace, 4, 1, 1, 0, 1, 1)
});

registerShortcut("MoveWindowToCenterHeight4x2_centerbiased", "UltrawideWindows: Move Window to center-height (4x2 center biased)", "Ctrl+Meta+Num+5", function () {
    move(workspace, 4, 1, 1, 0, 2, 1)
});

registerShortcut("MoveWindowToCenterRightHeight4x2_centerbiased", "UltrawideWindows: Move Window to center-right-height (4x2 center biased)", "Ctrl+Meta+Shift+Num+6", function () {
    move(workspace, 4, 1, 2, 0, 1, 1)
});

registerShortcut("MoveWindowToRightHeight4x2_centerbiased", "UltrawideWindows: Move Window to right-height (4x2 center biased)", "Ctrl+Meta+Num+6", function () {
    move(workspace, 4, 1, 3, 0, 1, 1)
});


// Fit 2/3 screen
registerShortcut("MoveWindowToUpLeft23", "UltrawideWindows: Move Window to fit up-left 2/3 width ", "alt+Num+7", function () {
    move(workspace, 3, 2, 0, 0, 2, 1)
});

registerShortcut("MoveWindowToUpCenter23", "UltrawideWindows: Move Window to up-width 2/3", "alt+Num+8", function () {
    move(workspace, 1, 2, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToUpRight23", "UltrawideWindows: Move Window to fit up-right 2/3 width ", "alt+Num+9", function () {
    move(workspace, 3, 2, 1, 0, 2, 1)
});

registerShortcut("MoveWindowToFitDownLeft23", "UltrawideWindows: Move Window to fit down-left 2/3 width ", "alt+Num+1", function () {
    move(workspace, 3, 2, 0, 1, 2, 1)
});

registerShortcut("MoveWindowToDownCenter23", "UltrawideWindows: Move Window to down-width 2/3", "alt+Num+2", function () {
    move(workspace, 1, 2, 0, 1, 1, 1)
});

registerShortcut("MoveWindowToFitDownRight23", "UltrawideWindows: Move Window to fit down-right 2/3 width ", "alt+Num+3", function () {
    move(workspace, 3, 2, 1, 1, 2, 1)
});

registerShortcut("MoveWindowToLeftHeight23", "UltrawideWindows: Move Window to fit left-height 2/3 width ", "alt+Num+4", function () {
    move(workspace, 3, 1, 0, 0, 2, 1)
});

registerShortcut("MoveWindowToRightHeight23", "UltrawideWindows: Move Window to fit right-height 2/3 width ", "alt+Num+6", function () {
    move(workspace, 3, 1, 1, 0, 2, 1)
});


// Fit 2/3 screen center biased (lateral windows fit accordingly to alt-X shortcuts)
registerShortcut("MoveWindowToUpLeft23_center_biased", "UltrawideWindows: Move Window to fit up-left 2/3 width (center biased)", "alt+meta+Num+7", function () {
    move(workspace, 6, 2, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToUpCenter23_center_biased", "UltrawideWindows: Move Window to up-center 2/3 (center biased)", "alt+meta+Num+8", function () {
    move(workspace, 6, 2, 1, 0, 4, 1)
});

registerShortcut("MoveWindowToUpRight23_center_biased", "UltrawideWindows: Move Window to fit up-right 2/3 width (center biased)", "alt+meta+Num+9", function () {
    move(workspace, 6, 2, 5, 0, 1, 1)
});

registerShortcut("MoveWindowToFitDownLeft23_center_biased", "UltrawideWindows: Move Window to fit down-left 2/3 width (center biased)", "alt+meta+Num+1", function () {
    move(workspace, 6, 2, 0, 1, 1, 1)
});

registerShortcut("MoveWindowToDownCenter23_center_biased", "UltrawideWindows: Move Window to down-center 2/3 (center biased)", "alt+meta+Num+2", function () {
    move(workspace, 6, 2, 1, 1, 4, 1)
});

registerShortcut("MoveWindowToFitDownRight23_center_biased", "UltrawideWindows: Move Window to fit down-right 2/3 width (center biased)", "alt+meta+Num+3", function () {
    move(workspace, 6, 2, 5, 1, 1, 1)
});

registerShortcut("MoveWindowToLeftHeight23_center_biased", "UltrawideWindows: Move Window to fit left-height 2/3 width (center biased)", "alt+meta+Num+4", function () {
    move(workspace, 6, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToCenterHeight23_center_biased", "UltrawideWindows: Move Window to fit center-height 2/3 width (center biased)", "alt+meta+Num+5", function () {
    move(workspace, 6, 1, 1, 0, 4, 1)
});

registerShortcut("MoveWindowToRightHeight23_center_biased", "UltrawideWindows: Move Window to fit right-height 2/3 width (center biased)", "alt+meta+Num+6", function () {
    move(workspace, 6, 1, 5, 0, 1, 1)
});

// General
registerShortcut("MoveWindowToMaximize", "UltrawideWindows: Maximize Window", "Meta+Num+0", function () {
    var client = workspace.activeWindow;
    client.setMaximize(true,true)
});

registerShortcut("MoveWindowToMaximize1", "UltrawideWindows: Maximize Window (copy)", "alt+Num+0", function () {
    move(workspace, 1, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToMaximize2", "UltrawideWindows: Maximize Window (copy2)", "ctrl+Num+0", function () {
    move(workspace, 1, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToMaximize3", "UltrawideWindows: Maximize Window (copy2)", "ctrl+meta+Num+0", function () {
    move(workspace, 1, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToMaximize4", "UltrawideWindows: Maximize Window (copy2)", "alt+meta+Num+0", function () {
    move(workspace, 1, 1, 0, 0, 1, 1)
});

registerShortcut("MoveWindowToCenter", "UltrawideWindows: Center Window", "ctrl+Num+5", function () {
    center(workspace)
});

registerShortcut("MoveWindowToCenter1", "UltrawideWindows: Center Window (copy)", "alt+Num+5", function () {
    center(workspace)
});

registerShortcut("IncreaseWindowSize", "UltrawideWindows: Increase the window size in place", "Ctrl+Meta+Num++", function () {
    resize(workspace, "grow", 20, 0);
});

registerShortcut("DecreaseWindowSize", "UltrawideWindows: Decrease the window size in place", "Ctrl+Meta+Num+-", function () {
    resize(workspace, "shrink", 20, 300);
});

registerShortcut("MoveWindowLeft", "UltrawideWindows: Move the window to the left", "Ctrl+Meta+Left", function () {
    moveWithFixedSize(workspace, "left", 20);
});

registerShortcut("MoveWindowRight", "UltrawideWindows: Move the window to the right", "Ctrl+Meta+Right", function () {
    moveWithFixedSize(workspace, "right", 20);
});

registerShortcut("MoveWindowUp", "UltrawideWindows: Move the window up", "Ctrl+Meta+Up", function () {
    moveWithFixedSize(workspace, "up", 20);
});

registerShortcut("MoveWindowDown", "UltrawideWindows: Move the window down", "Ctrl+Meta+Down", function () {
    moveWithFixedSize(workspace, "down", 20);
});
