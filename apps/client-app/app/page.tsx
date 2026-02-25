import { VALID_FOOD_TYPES, VALID_REACTIONS } from "@kafka-food-court/kafka-core";
import ClientUI from "../components/ClientUI";

export default function ClientAppPage() {
  return (
    <ClientUI
      foodTypes={VALID_FOOD_TYPES}
      reactions={VALID_REACTIONS}
    />
  );
}
