import { PartialType } from "@nestjs/swagger";
import { CreateProductDto } from "./create-product.dto";
import { UpdateProductRequestDto } from "@vetralink/shared-types";

export class UpdateProductDto
  extends PartialType(CreateProductDto)
  implements UpdateProductRequestDto {}
