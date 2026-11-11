import itertools
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.table import Table

# Логическая функция
def logic_function(a, b, c, d):
    return (a and not c) or d or (a and b) or (b and c) or (not a and c)

# Генерация таблицы истинности
def generate_truth_table():
    variables = ['a', 'b', 'c', 'd']
    combinations = list(itertools.product([0, 1], repeat=len(variables)))
    table_data = []
    for combo in combinations:
        a, b, c, d = combo
        y = logic_function(a, b, c, d)
        table_data.append([a, b, c, d, int(y)])
    return variables, table_data

# Визуализация таблицы истинности
def plot_truth_table(ax, variables, table_data):
    ax.axis('off')
    ax.set_title('Таблица истинности', fontsize=14, pad=20)
    cols = variables + ['y']
    rows = [str(i) for i in range(len(table_data))]
    cell_text = [[str(val) for val in row] for row in table_data]
    table = ax.table(cellText=cell_text, rowLabels=rows, colLabels=cols,
                     cellLoc='center', loc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1.0, 1.2)

# Рисование логического вентиля AND
def draw_and_gate(ax, x, y, w=0.6, h=0.4):
    rect = patches.FancyBboxPatch((x - w/2, y - h/2), w, h,
                                  boxstyle="round,pad=0.05",
                                  facecolor='lightblue', edgecolor='black')
    ax.add_patch(rect)
    ax.text(x, y, '&', ha='center', va='center', fontsize=10, fontweight='bold')

# Рисование логического вентиля OR
def draw_or_gate(ax, x, y, w=0.6, h=0.4):
    # Основание как дуга (упрощённо рисуем прямоугольник со скруглением и дополнительной дугой)
    rect = patches.FancyBboxPatch((x - w/2, y - h/2), w, h,
                                  boxstyle="round,pad=0.05",
                                  facecolor='lightgreen', edgecolor='black')
    ax.add_patch(rect)
    # Добавим дугу на задней стороне для обозначения OR
    arc = patches.Arc((x - w/2, y), w*0.8, h*1.2, angle=0, theta1=-50, theta2=50,
                      edgecolor='black', lw=1.5)
    ax.add_patch(arc)
    ax.text(x, y, '≥1', ha='center', va='center', fontsize=10, fontweight='bold')

# Рисование инвертора (NOT)
def draw_not_gate(ax, x, y, r=0.2):
    # Треугольник
    triangle = patches.Polygon([(x - r, y - r*0.8), (x - r, y + r*0.8), (x + r, y)],
                               facecolor='lightcoral', edgecolor='black')
    ax.add_patch(triangle)
    # Кружок инверсии
    circle = patches.Circle((x + r + 0.1, y), 0.08, facecolor='white', edgecolor='black')
    ax.add_patch(circle)
    ax.text(x - 0.1, y, '1', ha='center', va='center', fontsize=8)

# Рисование точки соединения
def draw_connection_point(ax, x, y):
    ax.plot(x, y, 'ko', markersize=3)

# Основная функция рисования схемы
def plot_scheme(ax):
    ax.set_xlim(0, 13)
    ax.set_ylim(-1, 10)
    ax.axis('off')
    ax.set_title('Логическая схема', fontsize=14, pad=10)

    # --- Входы ---
    inputs = {'a': (0, 8), 'b': (0, 6), 'c': (0, 4), 'd': (0, 2)}
    for name, (x, y) in inputs.items():
        ax.text(x - 0.3, y, name, ha='center', va='center', fontsize=11, fontweight='bold')
        ax.plot([x, x+0.3], [y, y], 'k-', lw=1.5)  # линия вправо

    # --- Инверторы ---
    # NOT c
    not_c_pos = (2, 4)
    draw_not_gate(ax, *not_c_pos)
    ax.plot([0.3, 1.8], [4, 4], 'k-', lw=1.5)  # линия от c к NOT
    # NOT a
    not_a_pos = (2, 8)
    draw_not_gate(ax, *not_a_pos)
    ax.plot([0.3, 1.8], [8, 8], 'k-', lw=1.5)  # линия от a к NOT

    # Точки выхода инверторов (для подключения)
    not_c_out = (2.4, 4)
    not_a_out = (2.4, 8)
    draw_connection_point(ax, *not_c_out)
    draw_connection_point(ax, *not_a_out)

    # --- AND вентили ---
    # t1 = a AND not_c  -> входы a(y=8) и not_c(y=4)
    t1_pos = (5, 6)
    draw_and_gate(ax, *t1_pos)
    # соединения к t1
    ax.plot([0.3, 3.2], [8, 8], 'k-', lw=1)  # от a горизонтально
    ax.plot([3.2, 3.2], [8, 6.2], 'k-', lw=1) # вниз
    ax.plot([3.2, 4.7], [6.2, 6.2], 'k-', lw=1) # вход
    ax.plot([2.4, 2.8, 3.2], [4, 4, 5.8], 'k-', lw=1)  # от not_c
    ax.plot([3.2, 4.7], [5.8, 5.8], 'k-', lw=1)

    # t2 = a AND b -> входы a(y=8), b(y=6)
    t2_pos = (5, 7.5)
    draw_and_gate(ax, *t2_pos)
    ax.plot([0.3, 3.5], [8, 8], 'k-', lw=1)  # от a
    ax.plot([3.5, 3.5], [8, 7.7], 'k-', lw=1)
    ax.plot([3.5, 4.7], [7.7, 7.7], 'k-', lw=1)
    ax.plot([0.3, 3.5], [6, 6], 'k-', lw=1)  # от b
    ax.plot([3.5, 3.5], [6, 7.3], 'k-', lw=1)
    ax.plot([3.5, 4.7], [7.3, 7.3], 'k-', lw=1)

    # t3 = b AND c -> входы b(y=6), c(y=4)
    t3_pos = (5, 4.5)
    draw_and_gate(ax, *t3_pos)
    ax.plot([0.3, 3.0], [6, 6], 'k-', lw=1)
    ax.plot([3.0, 3.0], [6, 4.7], 'k-', lw=1)
    ax.plot([3.0, 4.7], [4.7, 4.7], 'k-', lw=1)
    ax.plot([0.3, 3.0], [4, 4], 'k-', lw=1)
    ax.plot([3.0, 3.0], [4, 4.3], 'k-', lw=1)
    ax.plot([3.0, 4.7], [4.3, 4.3], 'k-', lw=1)

    # t4 = not_a AND c -> входы not_a(y=8), c(y=4)
    t4_pos = (5, 2)
    draw_and_gate(ax, *t4_pos)
    # not_a(y=8) вниз
    ax.plot([2.4, 3.8], [8, 8], 'k-', lw=1)
    ax.plot([3.8, 3.8], [8, 2.2], 'k-', lw=1)  # вертикальная линия
    ax.plot([3.8, 4.7], [2.2, 2.2], 'k-', lw=1)
    # c(y=4)
    ax.plot([0.3, 2.2], [4, 4], 'k-', lw=1)
    ax.plot([2.2, 2.2], [4, 1.8], 'k-', lw=1)
    ax.plot([2.2, 4.7], [1.8, 1.8], 'k-', lw=1)
    # точка соединения на not_a? Уже есть.

    # --- OR каскад ---
    # or1 = t1 OR t2
    or1_pos = (7.5, 6.75)
    draw_or_gate(ax, *or1_pos)
    ax.plot([5.3, 6.5], [6, 6], 'k-', lw=1)   # t1_out -> or1
    ax.plot([6.5, 6.5], [6, 6.95], 'k-', lw=1)
    ax.plot([6.5, 7.2], [6.95, 6.95], 'k-', lw=1)
    ax.plot([5.3, 6.8], [7.5, 7.5], 'k-', lw=1) # t2_out -> or1
    ax.plot([6.8, 6.8], [7.5, 6.55], 'k-', lw=1)
    ax.plot([6.8, 7.2], [6.55, 6.55], 'k-', lw=1)

    # or2 = t3 OR t4
    or2_pos = (7.5, 3.25)
    draw_or_gate(ax, *or2_pos)
    ax.plot([5.3, 6.6], [4.5, 4.5], 'k-', lw=1)
    ax.plot([6.6, 6.6], [4.5, 3.45], 'k-', lw=1)
    ax.plot([6.6, 7.2], [3.45, 3.45], 'k-', lw=1)
    ax.plot([5.3, 6.6], [2, 2], 'k-', lw=1)
    ax.plot([6.6, 6.6], [2, 3.05], 'k-', lw=1)
    ax.plot([6.6, 7.2], [3.05, 3.05], 'k-', lw=1)

    # or3 = or1 OR or2
    or3_pos = (9.5, 5)
    draw_or_gate(ax, *or3_pos)
    ax.plot([7.8, 8.6], [6.75, 6.75], 'k-', lw=1)
    ax.plot([8.6, 8.6], [6.75, 5.2], 'k-', lw=1)
    ax.plot([8.6, 9.2], [5.2, 5.2], 'k-', lw=1)
    ax.plot([7.8, 8.6], [3.25, 3.25], 'k-', lw=1)
    ax.plot([8.6, 8.6], [3.25, 4.8], 'k-', lw=1)
    ax.plot([8.6, 9.2], [4.8, 4.8], 'k-', lw=1)

    # or4 = or3 OR d (d = вход y=2)
    or4_pos = (11.5, 3)
    draw_or_gate(ax, *or4_pos)
    # от or3
    ax.plot([9.8, 10.5], [5, 5], 'k-', lw=1)
    ax.plot([10.5, 10.5], [5, 3.2], 'k-', lw=1)
    ax.plot([10.5, 11.2], [3.2, 3.2], 'k-', lw=1)
    # от d (y=2) поднимаем
    ax.plot([0.3, 5.5], [2, 2], 'k-', lw=1)
    ax.plot([5.5, 5.5], [2, 2.8], 'k-', lw=1)   # обход or2
    ax.plot([5.5, 11.2], [2.8, 2.8], 'k-', lw=1)
    # точка на d
    draw_connection_point(ax, 0.3, 2)

    # Выход y
    y_x, y_y = 12.2, 3
    ax.text(y_x + 0.3, y_y, 'y', ha='center', va='center', fontsize=11, fontweight='bold')
    ax.plot([11.8, y_x], [3, y_y], 'k-', lw=1.5)
    draw_connection_point(ax, 11.8, 3)

# Главная функция визуализации
def visualize():
    variables, table_data = generate_truth_table()

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    plot_truth_table(ax1, variables, table_data)
    plot_scheme(ax2)

    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    visualize()